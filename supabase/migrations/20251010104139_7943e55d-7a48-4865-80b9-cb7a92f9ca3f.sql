-- Allow admins to insert new robots
CREATE POLICY "Admins can insert robots" 
ON public.robot_arms 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));