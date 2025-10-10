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

    await this.peerConnection.setRemoteDescription(offer);
    
    // Create answer
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    
    // Send answer through signaling
    await this.sendSignalingMessage({
      type: 'answer',
      answer,
      robotId: this.robotId,
      senderId: this.operatorId,
    });
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    await this.peerConnection.addIceCandidate(candidate);
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

  private async sendSignalingMessage(message: any): Promise<void> {
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
      messages.forEach(async (message: any) => {
        if (message.processed || message.senderId === this.operatorId) return;
        
        try {
          switch (message.type) {
            case 'offer':
              await this.handleOffer(message.offer);
              break;
            case 'ice-candidate':
              await this.handleIceCandidate(message.candidate);
              break;
          }
          
          // Mark as processed
          message.processed = true;
        } catch (error) {
          console.error('Error processing signaling message:', error);
        }
      });
      
      // Update localStorage
      localStorage.setItem(signalingKey, JSON.stringify(messages));
    }, 2000);
    
    // Store interval for cleanup
    (this as any).signalingInterval = pollInterval;
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
    if ((this as any).signalingInterval) {
      clearInterval((this as any).signalingInterval);
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
    
    console.log('WebRTC receiver cleaned up');
  }
}