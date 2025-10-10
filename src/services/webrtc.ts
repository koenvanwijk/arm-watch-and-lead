import { supabase } from "@/integrations/supabase/client";

export interface WebRTCQualitySettings {
  width: number;
  height: number;
  frameRate: number;
  bitrate: number;
}

export const QUALITY_PRESETS = {
  low: {
    width: 320,
    height: 240,
    frameRate: 15,
    bitrate: 200000, // 200kbps
  },
  medium: {
    width: 640,
    height: 480,
    frameRate: 24,
    bitrate: 500000, // 500kbps
  },
  high: {
    width: 1280,
    height: 720,
    frameRate: 30,
    bitrate: 1500000, // 1.5Mbps
  },
} as const;

export type QualityLevel = keyof typeof QUALITY_PRESETS;

export class WebRTCStreamer {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private robotId: string;
  private currentQuality: QualityLevel = 'low';
  private hasAudio: boolean = false;
  private onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  private onQualityChange?: (quality: QualityLevel) => void;
  private onAudioStatusChange?: (hasAudio: boolean) => void;

  constructor(
    robotId: string,
    onConnectionStateChange?: (state: RTCPeerConnectionState) => void,
    onQualityChange?: (quality: QualityLevel) => void,
    onAudioStatusChange?: (hasAudio: boolean) => void
  ) {
    this.robotId = robotId;
    this.onConnectionStateChange = onConnectionStateChange;
    this.onQualityChange = onQualityChange;
    this.onAudioStatusChange = onAudioStatusChange;
  }

  async initialize(): Promise<void> {
    try {
      // Get user media with initial low quality
      this.localStream = await this.getMediaStream(this.currentQuality);
      
      // Check if we have audio
      this.hasAudio = this.localStream.getAudioTracks().length > 0;
      if (this.onAudioStatusChange) {
        this.onAudioStatusChange(this.hasAudio);
      }
      
      console.log(`WebRTC initialized with ${this.hasAudio ? 'video + audio' : 'video only'}`);
      
      // Create peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      // Add local stream to peer connection
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      // Create data channel for quality control
      this.dataChannel = this.peerConnection.createDataChannel('quality-control', {
        ordered: true
      });

      this.setupDataChannelHandlers();
      this.setupPeerConnectionHandlers();
      
      console.log('WebRTC streamer initialized for robot:', this.robotId);
    } catch (error) {
      console.error('Failed to initialize WebRTC streamer:', error);
      throw error;
    }
  }

  private async getMediaStream(quality: QualityLevel): Promise<MediaStream> {
    const settings = QUALITY_PRESETS[quality];
    
    const videoConstraints: MediaStreamConstraints = {
      video: {
        width: { ideal: settings.width },
        height: { ideal: settings.height },
        frameRate: { ideal: settings.frameRate },
        facingMode: 'environment', // Use back camera if available
      },
    };

    try {
      // First try to get both video and audio
      const streamWithAudio = await navigator.mediaDevices.getUserMedia({
        ...videoConstraints,
        audio: true,
      });
      console.log('Got video + audio stream');
      return streamWithAudio;
    } catch (error) {
      console.warn('Failed to get audio, trying video only:', error);
      
      try {
        // Fallback to video only if audio fails
        const videoOnlyStream = await navigator.mediaDevices.getUserMedia(videoConstraints);
        console.log('Got video-only stream');
        return videoOnlyStream;
      } catch (videoError) {
        console.error('Failed to get video stream:', videoError);
        throw new Error('Camera access denied or not available');
      }
    }
  }

  private setupDataChannelHandlers(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log('Data channel opened');
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'quality-change') {
          this.changeQuality(message.quality);
        }
      } catch (error) {
        console.error('Error parsing data channel message:', error);
      }
    };

    this.dataChannel.onclose = () => {
      console.log('Data channel closed');
    };
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
        // Send ICE candidate through Supabase signaling
        await this.sendSignalingMessage({
          type: 'ice-candidate',
          candidate: event.candidate,
          robotId: this.robotId,
        });
      }
    };

    this.peerConnection.ondatachannel = (event) => {
      const channel = event.channel;
      channel.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'quality-request') {
            this.changeQuality(message.quality);
          }
        } catch (error) {
          console.error('Error parsing data channel message:', error);
        }
      };
    };
  }

  async changeQuality(newQuality: QualityLevel): Promise<void> {
    if (newQuality === this.currentQuality) return;

    try {
      console.log(`Changing video quality from ${this.currentQuality} to ${newQuality}`);
      
      // Get new media stream with updated quality
      const newStream = await this.getMediaStream(newQuality);
      
      // Check if audio status changed
      const newHasAudio = newStream.getAudioTracks().length > 0;
      if (newHasAudio !== this.hasAudio) {
        this.hasAudio = newHasAudio;
        if (this.onAudioStatusChange) {
          this.onAudioStatusChange(this.hasAudio);
        }
      }
      
      // Replace tracks in peer connection
      if (this.peerConnection && this.localStream) {
        // Replace video track
        const videoTrack = newStream.getVideoTracks()[0];
        const videoSender = this.peerConnection.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        
        if (videoSender && videoTrack) {
          await videoSender.replaceTrack(videoTrack);
        }
        
        // Replace audio track if available
        const audioTrack = newStream.getAudioTracks()[0];
        const audioSender = this.peerConnection.getSenders().find(s => 
          s.track && s.track.kind === 'audio'
        );
        
        if (audioSender && audioTrack) {
          await audioSender.replaceTrack(audioTrack);
        } else if (audioTrack && !audioSender) {
          // Add audio track if we didn't have one before
          this.peerConnection.addTrack(audioTrack, newStream);
        }
        
        // Stop old tracks
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = newStream;
      }

      this.currentQuality = newQuality;
      
      if (this.onQualityChange) {
        this.onQualityChange(newQuality);
      }
      
      console.log(`Video quality changed to ${newQuality} ${this.hasAudio ? 'with audio' : 'video only'}`);
    } catch (error) {
      console.error('Failed to change video quality:', error);
    }
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    
    // Send offer through Supabase signaling
    await this.sendSignalingMessage({
      type: 'offer',
      offer,
      robotId: this.robotId,
    });

    return offer;
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    await this.peerConnection.setRemoteDescription(answer);
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    await this.peerConnection.addIceCandidate(candidate);
  }

  private async sendSignalingMessage(message: any): Promise<void> {
    try {
      // For now, we'll use console logging for signaling
      // In production, this would use the webrtc_signaling table
      console.log('Signaling message:', message);
      
      // Store in localStorage as a fallback for demo purposes
      const signalingKey = `webrtc_signaling_${this.robotId}`;
      const existingMessages = JSON.parse(localStorage.getItem(signalingKey) || '[]');
      existingMessages.push({
        ...message,
        timestamp: Date.now(),
      });
      localStorage.setItem(signalingKey, JSON.stringify(existingMessages));
    } catch (error) {
      console.error('Failed to send signaling message:', error);
    }
  }

  async startListeningForSignaling(): Promise<void> {
    // For now, we'll use a polling approach for demo purposes
    // In production, this would use Supabase real-time subscriptions
    console.log('Started listening for signaling messages for robot:', this.robotId);
    
    // Poll for messages every 2 seconds
    const pollInterval = setInterval(() => {
      const signalingKey = `webrtc_signaling_${this.robotId}`;
      const messages = JSON.parse(localStorage.getItem(signalingKey) || '[]');
      
      // Process new messages
      messages.forEach(async (message: any) => {
        if (message.processed) return;
        
        try {
          switch (message.type) {
            case 'answer':
              await this.handleAnswer(message.answer);
              break;
            case 'ice-candidate':
              await this.handleIceCandidate(message.candidate);
              break;
            case 'quality-request':
              await this.changeQuality(message.quality);
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

  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null;
  }

  getCurrentQuality(): QualityLevel {
    return this.currentQuality;
  }

  hasAudioTrack(): boolean {
    return this.hasAudio;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  async cleanup(): Promise<void> {
    // Clear polling interval
    if ((this as any).signalingInterval) {
      clearInterval((this as any).signalingInterval);
    }
    
    // Stop all tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }

    // Close data channel
    if (this.dataChannel) {
      this.dataChannel.close();
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    this.localStream = null;
    this.dataChannel = null;
    this.peerConnection = null;
    
    console.log('WebRTC streamer cleaned up');
  }
}