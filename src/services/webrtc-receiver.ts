import { supabase } from "@/integrations/supabase/client";
import { QualityLevel, QUALITY_PRESETS } from "./webrtc";

export class WebRTCReceiver {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private robotId: string;
  private operatorId: string;
  private remoteStream: MediaStream | null = null;
  private currentQuality: QualityLevel = 'low';
  private onStreamReceived?: (stream: MediaStream) => void;
  private onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  private onQualityChange?: (quality: QualityLevel) => void;
  private signalingInterval?: NodeJS.Timeout;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet: boolean = false;
  private processedMessages: Set<string> = new Set();

  constructor(
    robotId: string,
    operatorId: string,
    onStreamReceived?: (stream: MediaStream) => void,
    onConnectionStateChange?: (state: RTCPeerConnectionState) => void,
    onQualityChange?: (quality: QualityLevel) => void
  ) {
    this.robotId = robotId;
    this.operatorId = operatorId;
    this.onStreamReceived = onStreamReceived;
    this.onConnectionStateChange = onConnectionStateChange;
    this.onQualityChange = onQualityChange;
  }

  async initialize(): Promise<void> {
    try {
      console.log(`Initializing WebRTC receiver for robot ${this.robotId}, operator ${this.operatorId}`);
      
      // Create peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      this.setupPeerConnectionHandlers();
      
      // Start listening for signaling messages
      await this.startListeningForSignaling();
      
      // Request connection from robot
      await this.requestConnection();
      
      console.log('WebRTC receiver initialized for robot:', this.robotId);
    } catch (error) {
      console.error('Failed to initialize WebRTC receiver:', error);
      throw error;
    }
  }

  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return;

    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection && this.onConnectionStateChange) {
        this.onConnectionStateChange(this.peerConnection.connectionState);
      }
    };

    this.peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        // Send ICE candidate through signaling
        await this.sendSignalingMessage({
          type: 'ice-candidate',
          candidate: event.candidate,
          robotId: this.robotId,
          senderId: this.operatorId,
        });
      }
    };

    this.peerConnection.ontrack = (event) => {
      console.log('Received remote stream');
      this.remoteStream = event.streams[0];
      if (this.onStreamReceived) {
        this.onStreamReceived(this.remoteStream);
      }
    };

    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannelHandlers();
    };
  }

  private setupDataChannelHandlers(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log('Data channel opened (receiver)');
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'quality-change') {
          this.currentQuality = message.quality;
          if (this.onQualityChange) {
            this.onQualityChange(message.quality);
          }
        }
      } catch (error) {
        console.error('Error parsing data channel message:', error);
      }
    };
  }

  async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    console.log('Received offer from robot:', this.robotId);
    console.log('Peer connection state before offer:', this.peerConnection.connectionState);
    console.log('Signaling state before offer:', this.peerConnection.signalingState);

    // Check if we're in a valid state to handle an offer
    if (this.peerConnection.signalingState !== 'stable') {
      console.warn('Invalid signaling state for offer:', this.peerConnection.signalingState);
      // Reset the connection if it's in a bad state
      if (this.peerConnection.signalingState === 'have-local-offer') {
        console.log('Resetting peer connection due to bad state');
        await this.resetPeerConnection();
        return;
      }
    }

    try {
      await this.peerConnection.setRemoteDescription(offer);
      this.remoteDescriptionSet = true;
      console.log('Remote description set, signaling state:', this.peerConnection.signalingState);
      
      // Process any pending ICE candidates
      for (const candidate of this.pendingIceCandidates) {
        try {
          await this.peerConnection.addIceCandidate(candidate);
          console.log('Added pending ICE candidate');
        } catch (error) {
          console.error('Failed to add pending ICE candidate:', error);
        }
      }
      this.pendingIceCandidates = [];
      
      // Check if we can create an answer
      if (this.peerConnection.signalingState === 'have-remote-offer') {
        // Create answer
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        console.log('Answer created and set as local description');
        
        // Send answer through signaling
        await this.sendSignalingMessage({
          type: 'answer',
          answer,
          robotId: this.robotId,
          senderId: this.operatorId,
        });

        console.log('Answer sent through signaling');
      } else {
        console.error('Cannot create answer, signaling state:', this.peerConnection.signalingState);
      }
    } catch (error) {
      console.error('Error handling offer:', error);
      this.remoteDescriptionSet = false;
    }
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    // If remote description is not set yet, queue the candidate
    if (!this.remoteDescriptionSet) {
      console.log('Queueing ICE candidate (remote description not set yet)');
      this.pendingIceCandidates.push(candidate);
      return;
    }

    try {
      await this.peerConnection.addIceCandidate(candidate);
      console.log('Added ICE candidate');
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
    }
  }

  async requestQualityChange(quality: QualityLevel): Promise<void> {
    if (quality === this.currentQuality) return;

    // Send quality request through signaling
    await this.sendSignalingMessage({
      type: 'quality-request',
      quality,
      robotId: this.robotId,
      senderId: this.operatorId,
    });

    // Also send through data channel if available
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({
        type: 'quality-request',
        quality,
      }));
    }

    console.log(`Requested quality change to ${quality}`);
  }

  private async requestConnection(): Promise<void> {
    // Send connection request to robot
    await this.sendSignalingMessage({
      type: 'connection-request',
      robotId: this.robotId,
      senderId: this.operatorId,
    });
    console.log(`Requested connection to robot ${this.robotId}`);
  }

  private async resetPeerConnection(): Promise<void> {
    console.log('Resetting peer connection');
    
    // Close existing connection
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    
    // Reset state
    this.remoteDescriptionSet = false;
    this.pendingIceCandidates = [];
    
    // Create new peer connection
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    this.setupPeerConnectionHandlers();
    
    // Request new connection
    await this.requestConnection();
  }

  private async sendSignalingMessage(message: Record<string, unknown>): Promise<void> {
    try {
      // For now, use localStorage for demo (same as streamer)
      console.log('Receiver signaling message:', message);
      
      const signalingKey = `webrtc_signaling_${this.robotId}`;
      const existingMessages = JSON.parse(localStorage.getItem(signalingKey) || '[]');
      existingMessages.push({
        ...message,
        timestamp: Date.now(),
        receiverId: this.operatorId,
      });
      localStorage.setItem(signalingKey, JSON.stringify(existingMessages));
    } catch (error) {
      console.error('Failed to send signaling message:', error);
    }
  }

  async startListeningForSignaling(): Promise<void> {
    console.log('Started listening for signaling messages for robot:', this.robotId);
    
    // Poll for messages every 2 seconds
    const pollInterval = setInterval(() => {
      const signalingKey = `webrtc_signaling_${this.robotId}`;
      const messages = JSON.parse(localStorage.getItem(signalingKey) || '[]');
      
      // Process new messages from the robot
      messages.forEach(async (message: Record<string, unknown>) => {
        if (message.processed || message.senderId === this.operatorId) return;
        
        // Create a unique message ID for deduplication
        const messageId = `${message.type}-${message.timestamp}-${message.senderId}`;
        if (this.processedMessages.has(messageId)) {
          console.log('Skipping duplicate message:', messageId);
          return;
        }
        
        try {
          switch (message.type) {
            case 'offer':
              await this.handleOffer(message.offer as RTCSessionDescriptionInit);
              break;
            case 'ice-candidate':
              await this.handleIceCandidate(message.candidate as RTCIceCandidateInit);
              break;
          }
          
          // Mark as processed
          message.processed = true;
          this.processedMessages.add(messageId);
        } catch (error) {
          console.error('Error processing signaling message:', error);
        }
      });
      
      // Update localStorage
      localStorage.setItem(signalingKey, JSON.stringify(messages));
    }, 2000);
    
    // Store interval for cleanup
    this.signalingInterval = pollInterval;
  }

  // Request focused mode (high quality)
  async requestFocus(): Promise<void> {
    await this.requestQualityChange('high');
  }

  // Release focus (low quality)
  async releaseFocus(): Promise<void> {
    await this.requestQualityChange('low');
  }

  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null;
  }

  getCurrentQuality(): QualityLevel {
    return this.currentQuality;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  async cleanup(): Promise<void> {
    // Clear polling interval
    if (this.signalingInterval) {
      clearInterval(this.signalingInterval);
    }

    // Close data channel
    if (this.dataChannel) {
      this.dataChannel.close();
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    this.dataChannel = null;
    this.peerConnection = null;
    this.remoteStream = null;
    this.remoteDescriptionSet = false;
    this.pendingIceCandidates = [];
    this.processedMessages.clear();
    
    console.log('WebRTC receiver cleaned up');
  }
}