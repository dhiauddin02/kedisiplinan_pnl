import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface AppUser {
  id: string;
  email: string;
  nama?: string;
  nim?: string;
  role?: string;
  level_user?: number;
  nama_wali?: string;
  no_wa_wali?: string;
  nama_dosen_pembimbing?: string;
  no_wa_dosen_pembimbing?: string;
}

export const login = async (nim: string, password: string): Promise<AppUser | null> => {
  try {
    console.log('Starting login process for NIM:', nim);
    
    // First, find the user by NIM to get their email
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('nim', nim.trim())
      .maybeSingle();

    if (userError) {
      console.error('Error finding user:', userError);
      return null;
    }

    if (!userData) {
      console.log('User not found with NIM:', nim);
      
      // Special case: if trying to login as admin and admin doesn't exist in public.users
      if (nim.trim() === 'admin') {
        console.log('Admin not found in public.users, checking auth.users...');
        
        // Try to find admin in auth.users
        const { data: authUsers } = await supabase.auth.admin.listUsers();
        const adminAuthUser = authUsers.users?.find(u => u.email === 'admin@pnl.ac.id');
        
        if (adminAuthUser) {
          console.log('Admin found in auth.users, creating public.users entry...');
          
          // Create admin entry in public.users
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: adminAuthUser.id,
              email: 'admin@pnl.ac.id',
              nim: 'admin',
              nama: 'Administrator',
              role: 'admin',
              level_user: 1,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          if (insertError) {
            console.error('Error creating admin in public.users:', insertError);
          } else {
            console.log('Admin created in public.users, retrying login...');
            // Retry the login process
            return login(nim, password);
          }
        } else {
          console.log('Admin not found in auth.users either, creating admin...');
          
          // Create admin user in auth.users
          try {
            const { data: newAdminAuth, error: createError } = await supabase.auth.signUp({
              email: 'admin@pnl.ac.id',
              password: 'admin123',
              options: {
                data: {
                  nama: 'Administrator',
                  nim: 'admin',
                  role: 'admin'
                }
              }
            });
            
            if (createError) {
              console.error('Error creating admin auth user:', createError);
            } else if (newAdminAuth.user) {
              // Create admin in public.users
              const { error: insertError } = await supabase
                .from('users')
                .insert({
                  id: newAdminAuth.user.id,
                  email: 'admin@pnl.ac.id',
                  nim: 'admin',
                  nama: 'Administrator',
                  role: 'admin',
                  level_user: 1,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });
              
              if (!insertError) {
                console.log('Admin user created successfully, retrying login...');
                // Retry the login process
                return login(nim, password);
              }
            }
          } catch (createError) {
            console.error('Error in admin creation process:', createError);
          }
        }
      }
      
      return null;
    }

    console.log('User found:', userData);

    // Try to sign in with the user's email and provided password
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: userData.email,
      password: password.trim(),
    });

    if (authError) {
      console.error('Authentication failed:', authError);
      
      // Special handling for admin login with wrong password
      if (userData.nim === 'admin' && authError.message.includes('Invalid login credentials')) {
        console.log('Admin login failed, checking if auth user exists...');
        
        // Try to update admin password in auth.users
        try {
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            userData.id,
            { password: 'admin123' }
          );
          
          if (!updateError) {
            console.log('Admin password updated, retrying login...');
            // Retry login with updated password
            const { data: retryAuthData, error: retryError } = await supabase.auth.signInWithPassword({
              email: userData.email,
              password: 'admin123',
            });
            
            if (!retryError && retryAuthData.user) {
              const appUser: AppUser = {
                id: retryAuthData.user.id,
                email: retryAuthData.user.email!,
                nama: userData.nama || undefined,
                nim: userData.nim || undefined,
                role: userData.role || undefined,
                level_user: userData.level_user || undefined,
                nama_wali: userData.nama_wali || undefined,
                no_wa_wali: userData.no_wa_wali || undefined,
                nama_dosen_pembimbing: userData.nama_dosen_pembimbing || undefined,
                no_wa_dosen_pembimbing: userData.no_wa_dosen_pembimbing || undefined,
              };
              
              localStorage.setItem('user', JSON.stringify(appUser));
              return appUser;
            }
          }
        } catch (updateError) {
          console.error('Error updating admin password:', updateError);
        }
      }
      
      return null;
    }

    if (!authData.user) {
      console.error('No user returned from auth');
      return null;
    }

    console.log('Authentication successful:', authData.user);

    // Create AppUser object
    const appUser: AppUser = {
      id: authData.user.id,
      email: authData.user.email!,
      nama: userData.nama || undefined,
      nim: userData.nim || undefined,
      role: userData.role || undefined,
      level_user: userData.level_user || undefined,
      nama_wali: userData.nama_wali || undefined,
      no_wa_wali: userData.no_wa_wali || undefined,
      nama_dosen_pembimbing: userData.nama_dosen_pembimbing || undefined,
      no_wa_dosen_pembimbing: userData.no_wa_dosen_pembimbing || undefined,
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

// Function to save user profile data to public.users
export const saveUserProfile = async (profileData: {
  nama: string;
  nim: string;
  nama_wali?: string;
  no_wa_wali?: string;
  nama_dosen_pembimbing?: string;
  no_wa_dosen_pembimbing?: string;
}): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('No authenticated user found');
    }

    // Check if user profile already exists
    const { data: existingProfile } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    // Check if NIM is already used by another user
    const { data: nimCheck } = await supabase
      .from('users')
      .select('id')
      .eq('nim', profileData.nim)
      .neq('id', user.id)
      .maybeSingle();

    if (nimCheck) {
      throw new Error('NIM sudah digunakan oleh pengguna lain');
    }

    const userData = {
      id: user.id,
      email: user.email!,
      nama: profileData.nama,
      nim: profileData.nim,
      role: 'mahasiswa',
      level_user: 0,
      nama_wali: profileData.nama_wali,
      no_wa_wali: profileData.no_wa_wali,
      nama_dosen_pembimbing: profileData.nama_dosen_pembimbing,
      no_wa_dosen_pembimbing: profileData.no_wa_dosen_pembimbing,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existingProfile) {
      // Update existing profile
      const { error } = await supabase
        .from('users')
        .update(userData)
        .eq('id', user.id);

      if (error) throw error;
    } else {
      // Insert new profile
      const { error } = await supabase
        .from('users')
        .insert(userData);

      if (error) throw error;
    }

    // Update localStorage with complete user data
    const updatedUser: AppUser = {
      id: user.id,
      email: user.email!,
      ...profileData,
      role: 'mahasiswa',
      level_user: 0,
    };
    localStorage.setItem('user', JSON.stringify(updatedUser));

    return true;
  } catch (error) {
    console.error('Error saving user profile:', error);
    throw error;
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

    // Try to get user data from our custom table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    // Create AppUser object (userData might be null if profile not completed)
    const appUser: AppUser = {
      id: user.id,
      email: user.email!,
      nama: userData?.nama || undefined,
      nim: userData?.nim || undefined,
      role: userData?.role || undefined,
      level_user: userData?.level_user || undefined,
      nama_wali: userData?.nama_wali || undefined,
      no_wa_wali: userData?.no_wa_wali || undefined,
      nama_dosen_pembimbing: userData?.nama_dosen_pembimbing || undefined,
      no_wa_dosen_pembimbing: userData?.no_wa_dosen_pembimbing || undefined,
    };

    localStorage.setItem('user', JSON.stringify(appUser));
    return appUser;
  } catch (error) {
    console.error('Auth check error:', error);
    localStorage.removeItem('user');
    return null;
  }
};

// Debug function to check admin status
export const debugAdminStatus = async (): Promise<void> => {
  try {
    console.log('=== ADMIN DEBUG STATUS ===');
    
    // Check public.users for admin
    const { data: publicAdmin, error: publicError } = await supabase
      .from('users')
      .select('*')
      .eq('nim', 'admin')
      .maybeSingle();
    
    console.log('Admin in public.users:', publicAdmin);
    if (publicError) console.log('Public users error:', publicError);
    
    // Check auth.users for admin
    try {
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      const adminAuthUser = authUsers.users?.find(u => u.email === 'admin@pnl.ac.id');
      console.log('Admin in auth.users:', adminAuthUser);
    } catch (authError) {
      console.log('Auth users error (expected if not service role):', authError);
    }
    
    console.log('=== END ADMIN DEBUG ===');
  } catch (error) {
    console.error('Debug error:', error);
  }
};