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

    // Check if this is a placeholder user (no auth user yet)
    const { data: authUser } = await supabase.auth.getUser();
    
    // Try to sign in with existing auth user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: userData.email,
      password: password.trim(),
    });

    // If auth fails and this might be a new student, try to create auth user
    if (authError && authError.message.includes('Invalid login credentials')) {
      console.log('Auth user not found, attempting to create for student...');
      
      // Try to sign up the user (for students who were registered during clustering)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: userData.email,
        password: password.trim(),
      });

      if (signUpError) {
        console.error('Failed to create auth user:', signUpError);
        return null;
      }

      if (!signUpData.user) {
        console.error('No user returned from signup');
        return null;
      }

      // Update the placeholder user record with the real auth user ID
      const { error: updateError } = await supabase
        .from('users')
        .update({ id: signUpData.user.id })
        .eq('nim', nim.trim());

      if (updateError) {
        console.error('Failed to update user with auth ID:', updateError);
        return null;
      }

      // Use the signup data for the rest of the process
      const appUser: AppUser = {
        id: signUpData.user.id,
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
      console.log('New user created and logged in:', appUser);
      return appUser;
    }

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
    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
    });

    if (authError || !authData.user) {
      throw authError;
    }

    // Insert user data into our custom users table
    const { data: dbData, error: dbError } = await supabase
      .from('users')
      .insert({
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
      })
      .select()
      .single();

    if (dbError) {
      throw dbError;
    }

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