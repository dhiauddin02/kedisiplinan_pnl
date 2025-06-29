import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

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
  } catch (error) {
    console.error('Logout error:', error);
    localStorage.removeItem('user');
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

export const registerUser = async (userData: {
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
        password: userData.password,
      });

      if (signInError) {
        console.log('Sign in failed, user might not exist in auth.users, creating...');
        
        // Create user in auth.users
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: userData.email,
          password: userData.password,
        });

        if (signUpError) {
          if (signUpError.message.includes('User already registered')) {
            // User exists in auth but sign in failed, try to get user ID
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
              authUserId = authUser.id;
            } else {
              throw new Error('Cannot get auth user ID');
            }
          } else {
            throw signUpError;
          }
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
      
      // Create user in Supabase Auth first
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
      });

      if (authError) {
        if (authError.message.includes('User already registered')) {
          // User exists in auth, try to sign in to get ID
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: userData.email,
            password: userData.password,
          });

          if (signInError) {
            throw new Error('User exists in auth but cannot sign in');
          }

          authUserId = signInData.user!.id;
        } else {
          throw authError;
        }
      } else {
        authUserId = authData.user!.id;
      }

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
    return null;
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