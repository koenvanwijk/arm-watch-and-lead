-- Create role enum
CREATE TYPE public.app_role AS ENUM ('operator', 'admin');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create robot_arms table
CREATE TABLE public.robot_arms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('operational', 'attention', 'critical')),
  task_description TEXT NOT NULL,
  overview_video_url TEXT NOT NULL,
  gripper_video_url TEXT NOT NULL,
  help_requested BOOLEAN DEFAULT false,
  help_requested_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.robot_arms ENABLE ROW LEVEL SECURITY;

-- Create robot_assignments table
CREATE TABLE public.robot_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  robot_id TEXT REFERENCES public.robot_arms(id) ON DELETE CASCADE NOT NULL,
  assigned_operator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  focused_operator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  focused_at TIMESTAMPTZ,
  UNIQUE (robot_id)
);

ALTER TABLE public.robot_assignments ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get operator's assigned robot count
CREATE OR REPLACE FUNCTION public.get_operator_robot_count(_user_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.robot_assignments
  WHERE assigned_operator_id = _user_id
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for robot_arms
CREATE POLICY "Operators can view assigned robots"
  ON public.robot_arms FOR SELECT
  USING (
    public.has_role(auth.uid(), 'operator') AND
    (
      -- Robots assigned to this operator
      EXISTS (
        SELECT 1 FROM public.robot_assignments
        WHERE robot_id = robot_arms.id
        AND assigned_operator_id = auth.uid()
      )
      OR
      -- Unassigned robots (if operator has less than 10 robots)
      NOT EXISTS (
        SELECT 1 FROM public.robot_assignments
        WHERE robot_id = robot_arms.id
      ) AND public.get_operator_robot_count(auth.uid()) < 10
      OR
      -- Robots requesting help
      help_requested = true
    )
  );

CREATE POLICY "Admins can view all robots"
  ON public.robot_arms FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Operators can update robot status"
  ON public.robot_arms FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'operator') AND
    EXISTS (
      SELECT 1 FROM public.robot_assignments
      WHERE robot_id = robot_arms.id
      AND (assigned_operator_id = auth.uid() OR focused_operator_id = auth.uid())
    )
  );

CREATE POLICY "Admins can update all robots"
  ON public.robot_arms FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for robot_assignments
CREATE POLICY "Operators can view assignments for their robots"
  ON public.robot_assignments FOR SELECT
  USING (
    public.has_role(auth.uid(), 'operator') AND
    (assigned_operator_id = auth.uid() OR focused_operator_id = auth.uid())
  );

CREATE POLICY "Admins can view all assignments"
  ON public.robot_assignments FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Operators can claim focus"
  ON public.robot_assignments FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'operator') AND
    assigned_operator_id = auth.uid()
  );

CREATE POLICY "System can create assignments"
  ON public.robot_assignments FOR INSERT
  WITH CHECK (true);

-- Create trigger to update profiles updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_robot_arms_updated_at
  BEFORE UPDATE ON public.robot_arms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  -- Assign operator role by default
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'operator');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.robot_arms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.robot_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;