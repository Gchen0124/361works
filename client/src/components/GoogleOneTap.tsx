import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

declare global {
  interface Window {
    google?: any;
  }
}

interface GoogleOneTapProps {
  onSuccess?: () => void;
}

export function GoogleOneTap({ onSuccess }: GoogleOneTapProps) {
  const { refetchUser } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Google Identity Services script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (!window.google) return;

      // Initialize Google One Tap
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      // Render the Sign-In button
      if (buttonRef.current) {
        window.google.accounts.id.renderButton(
          buttonRef.current,
          {
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: 300,
          }
        );
      }

      // Show One Tap prompt automatically so users can sign in quickly
      window.google.accounts.id.prompt();
    };

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  async function handleCredentialResponse(response: any) {
    try {
      // Send the credential to your backend
      const result = await fetch('/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          credential: response.credential,
        }),
      });

      if (result.ok) {
        const data = await result.json();
        console.log('✅ Sign-in successful:', data);

        // Refetch user data
        await refetchUser();

        // Callback
        if (onSuccess) {
          onSuccess();
        } else {
          // Default: redirect to home
          window.location.href = '/';
        }
      } else {
        const error = await result.json();
        console.error('❌ Sign-in failed:', error);
        alert('Sign-in failed. Please try again.');
      }
    } catch (error) {
      console.error('❌ Sign-in error:', error);
      alert('An error occurred during sign-in.');
    }
  }

  return (
    <div className="google-signin-container">
      <div ref={buttonRef} id="googleSignInButton"></div>
    </div>
  );
}
