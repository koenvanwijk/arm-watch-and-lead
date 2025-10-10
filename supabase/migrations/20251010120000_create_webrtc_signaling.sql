-- Create webrtc_signaling table for WebRTC peer-to-peer communication
CREATE TABLE webrtc_signaling (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    robot_id TEXT NOT NULL,
    sender_id UUID REFERENCES auth.users(id),
    receiver_id UUID REFERENCES auth.users(id),
    message_type TEXT NOT NULL CHECK (message_type IN ('offer', 'answer', 'ice-candidate', 'quality-request')),
    message_data JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_webrtc_signaling_robot_id ON webrtc_signaling(robot_id);
CREATE INDEX idx_webrtc_signaling_receiver_id ON webrtc_signaling(receiver_id);
CREATE INDEX idx_webrtc_signaling_created_at ON webrtc_signaling(created_at);
CREATE INDEX idx_webrtc_signaling_processed ON webrtc_signaling(processed);

-- Enable RLS
ALTER TABLE webrtc_signaling ENABLE ROW LEVEL SECURITY;

-- Create policies for WebRTC signaling
CREATE POLICY "Users can insert signaling messages" ON webrtc_signaling
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can read their signaling messages" ON webrtc_signaling
    FOR SELECT USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

CREATE POLICY "Users can update their signaling messages" ON webrtc_signaling
    FOR UPDATE USING (auth.uid() = receiver_id);

-- Auto-cleanup old signaling messages (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_old_signaling_messages()
RETURNS void AS $$
BEGIN
    DELETE FROM webrtc_signaling 
    WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup to run every 30 minutes
-- Note: This would require pg_cron extension in production
COMMENT ON FUNCTION cleanup_old_signaling_messages() IS 'Cleanup function for old WebRTC signaling messages';