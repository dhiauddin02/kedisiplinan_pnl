import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface AppUser {
  id: string;
  email: string;
  nama: string;
  nim: string;
  role: string;
  level_user: number;
  nama_wali?: string;
  no_wa_wali?: string;
  nama_dosen_pembimbing?: string;
  no_wa_dosen_pembimbing?: string;
  tingkat?: string;
  kelas?: string;
}

// Store admin session for restoration
let adminSession: Session | null = null;
let adminUser: AppUser | null = null;

export const login = async (nim: string, password: string): Promise<AppUser | null> => {
  try {
    console.log('Starting login process for NIM:', nim);
    
    // First, get user data from our custom users table using NIM
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('nim', nim.trim())
      .single();

    if (userError || !userData) {
      console.error('User not found in users table:', userError);
      return null;
    }

    console.log('User found in database:', userData);

    // Try to sign in with email and password using Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: userData.email,
      password: password.trim(),
    });

    if (authError) {
      console.error('Authentication failed:', authError);
      return null;
    }

    if (!authData.user) {
      console.error('No user returned from auth');
      return null;
    }

    console.log('Authentication successful:', authData.user);

    // Return combined user data
    const appUser: AppUser = {
      id: authData.user.id,
      email: userData.email,
      nama: userData.nama,
      nim: userData.nim,
      role: userData.role,
      level_user: userData.level_user,
      nama_wali: userData.nama_wali,
      no_wa_wali: userData.no_wa_wali,
      nama_dosen_pembimbing: userData.nama_dosen_pembimbing,
      no_wa_dosen_pembimbing: userData.no_wa_dosen_pembimbing,
      tingkat: userData.tingkat,
      kelas: userData.kelas,
    };

    // Store admin session and user if this is an admin login
    if (userData.role === 'admin' && authData.session) {
      adminSession = authData.session;
      adminUser = appUser;
      console.log('Admin session and user stored for restoration');
    }

    // Store user data in localStorage for easy access
    localStorage.setItem('user', JSON.stringify(appUser));
    console.log('User data stored in localStorage:', appUser);
    
    return appUser;
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
};

export const logout = async () => {
  try {
    await supabase.auth.signOut();
    localStorage.removeItem('user');
    adminSession = null; // Clear stored admin session
    adminUser = null; // Clear stored admin user
  } catch (error) {
    console.error('Logout error:', error);
    localStorage.removeItem('user');
    adminSession = null;
    adminUser = null;
  }
};

export const getCurrentUser = (): AppUser | null => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

export const getCurrentAuthUser = async (): Promise<User | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const updatePassword = async (newPassword: string): Promise<boolean> => {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Update password error:', error);
    return false;
  }
};

// Function to store current admin session before registration operations
export const storeAdminSession = async (): Promise<Session | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const currentUser = getCurrentUser();
      if (currentUser?.role === 'admin') {
        adminSession = session;
        adminUser = currentUser;
        console.log('Admin session stored:', session.user.id);
        return session;
      }
    }
    return null;
  } catch (error) {
    console.error('Error storing admin session:', error);
    return null;
  }
};

// Function to restore admin session after registration operations
export const restoreAdminSession = async (): Promise<boolean> => {
  try {
    if (!adminSession || !adminUser) {
      console.log('No admin session or user to restore');
      return false;
    }

    console.log('Attempting to restore admin session...');

    // Set the session back to admin
    const { data, error } = await supabase.auth.setSession({
      access_token: adminSession.access_token,
      refresh_token: adminSession.refresh_token
    });

    if (error) {
      console.error('Error restoring admin session:', error);
      return false;
    }

    // Update localStorage with admin user data
    localStorage.setItem('user', JSON.stringify(adminUser));

    console.log('Admin session restored successfully');
    return true;
  } catch (error) {
    console.error('Error in restoreAdminSession:', error);
    return false;
  }
};

// Enhanced password generation for better Supabase Auth compatibility
const generateSecurePassword = (nim: string): string => {
  // For NIM-based passwords, ensure they meet Supabase Auth requirements
  // Minimum 6 characters (already met with 13-digit NIM)
  // Add complexity if needed
  if (nim.length >= 6) {
    return nim; // Use NIM directly if it's long enough
  } else {
    // Fallback: pad with secure suffix
    return nim + 'Pnl' + Math.random().toString(36).substring(2, 5);
  }
};

// New function to register user without affecting current session
export const registerUserWithoutSessionChange = async (userData: {
  email: string;
  password: string;
  nama: string;
  nim: string;
  role: string;
  level_user: number;
  nama_wali?: string;
  no_wa_wali?: string;
  nama_dosen_pembimbing?: string;
  no_wa_dosen_pembimbing?: string;
  tingkat?: string;
  kelas?: string;
}): Promise<AppUser | null> => {
  try {
    console.log('Starting registration for:', userData.nim);

    // Store current session before any auth operations
    const currentSession = await supabase.auth.getSession();
    const currentUser = getCurrentUser();

    // Generate secure password
    const securePassword = generateSecurePassword(userData.password);
    console.log('Using password length:', securePassword.length);

    // Check if user already exists in public.users table
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, nim')
      .eq('nim', userData.nim)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking existing user:', checkError);
      throw checkError;
    }

    let authUserId: string;

    if (existingUser) {
      console.log('User already exists in public.users:', existingUser);
      
      // Try to sign in to get the auth user ID
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password: securePassword,
      });

      if (signInError) {
        console.log('Sign in failed, user might not exist in auth.users, creating...');
        
        // Create user in auth.users using admin client
        const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
          email: userData.email,
          password: securePassword,
          email_confirm: true
        });

        if (signUpError) {
          console.error('Admin create user error:', signUpError);
          throw signUpError;
        } else {
          authUserId = signUpData.user!.id;
        }
      } else {
        authUserId = signInData.user!.id;
      }

      // Update the existing user record with the correct auth user ID
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          id: authUserId,
          ...userData,
          password: undefined, // Don't store password in public table
          nim: userData.nim // Ensure NIM stays the same
        })
        .eq('nim', userData.nim);

      if (updateError) {
        console.error('Error updating existing user:', updateError);
        throw updateError;
      }

      console.log('Updated existing user with auth ID:', authUserId);

    } else {
      console.log('Creating new user...');
      
      // Create user in Supabase Auth using admin client to avoid session change
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: securePassword,
        email_confirm: true
      });

      if (authError) {
        console.error('Auth admin create user error:', authError);
        throw authError;
      } else {
        authUserId = authData.user!.id;
      }

      console.log('Auth user created with ID:', authUserId);

      // Insert user data into our custom users table
      const { error: dbError } = await supabase
        .from('users')
        .insert({
          id: authUserId,
          email: userData.email,
          nama: userData.nama,
          nim: userData.nim,
          role: userData.role,
          level_user: userData.level_user,
          nama_wali: userData.nama_wali,
          no_wa_wali: userData.no_wa_wali,
          nama_dosen_pembimbing: userData.nama_dosen_pembimbing,
          no_wa_dosen_pembimbing: userData.no_wa_dosen_pembimbing,
          tingkat: userData.tingkat,
          kelas: userData.kelas,
        });

      if (dbError) {
        console.error('Error inserting user data:', dbError);
        throw dbError;
      }

      console.log('Created new user with ID:', authUserId);
    }

    // Restore the original session if it was an admin session
    if (currentSession.data.session && currentUser?.role === 'admin') {
      console.log('Restoring admin session after user creation...');
      await supabase.auth.setSession({
        access_token: currentSession.data.session.access_token,
        refresh_token: currentSession.data.session.refresh_token
      });
      localStorage.setItem('user', JSON.stringify(currentUser));
      console.log('Admin session restored');
    }

    const appUser: AppUser = {
      id: authUserId,
      email: userData.email,
      nama: userData.nama,
      nim: userData.nim,
      role: userData.role,
      level_user: userData.level_user,
      nama_wali: userData.nama_wali,
      no_wa_wali: userData.no_wa_wali,
      nama_dosen_pembimbing: userData.nama_dosen_pembimbing,
      no_wa_dosen_pembimbing: userData.no_wa_dosen_pembimbing,
      tingkat: userData.tingkat,
      kelas: userData.kelas,
    };

    console.log('Registration successful:', appUser);
    return appUser;
  } catch (error) {
    console.error('Registration error:', error);
    
    // Ensure admin session is restored even if there's an error
    const currentUser = getCurrentUser();
    if (adminSession && adminUser && currentUser?.role === 'admin') {
      console.log('Restoring admin session after error...');
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token
      });
      localStorage.setItem('user', JSON.stringify(adminUser));
    }
    
    return null;
  }
};

// Keep the original registerUser function for backward compatibility
export const registerUser = registerUserWithoutSessionChange;

// Debug function to check admin status
export const debugAdminStatus = async (): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    console.log('Current auth user:', user);
    
    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      console.log('Current user data:', userData);
      
      // Check if user can see admin users
      const { data: adminUsers } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'admin');
      
      console.log('Visible admin users:', adminUsers);
    }
  } catch (error) {
    console.error('Debug error:', error);
  }
};

// Check if user is authenticated
export const checkAuth = async (): Promise<AppUser | null> => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      localStorage.removeItem('user');
      return null;
    }

    // Get user data from our custom table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      localStorage.removeItem('user');
      return null;
    }

    const appUser: AppUser = {
      id: user.id,
      email: userData.email,
      nama: userData.nama,
      nim: userData.nim,
      role: userData.role,
      level_user: userData.level_user,
      nama_wali: userData.nama_wali,
      no_wa_wali: userData.no_wa_wali,
      nama_dosen_pembimbing: userData.nama_dosen_pembimbing,
      no_wa_dosen_pembimbing: userData.no_wa_dosen_pembimbing,
      tingkat: userData.tingkat,
      kelas: userData.kelas,
    };

    localStorage.setItem('user', JSON.stringify(appUser));
    return appUser;
  } catch (error) {
    console.error('Auth check error:', error);
    localStorage.removeItem('user');
    return null;
  }
};