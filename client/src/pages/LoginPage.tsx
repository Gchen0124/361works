import { GoogleOneTap } from '../components/GoogleOneTap';
import { useAuth } from '../contexts/AuthContext';
import { useEffect } from 'react';

export function LoginPage() {
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    // Redirect if already authenticated
    if (isAuthenticated) {
      window.location.href = '/';
    }
  }, [isAuthenticated]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            DailyGlass
          </h1>
          <p className="text-gray-600">
            Your 365-day journaling companion
          </p>
        </div>

        <div className="space-y-6">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-4">
              Sign in to start journaling
            </p>
          </div>

          <div className="flex justify-center">
            <GoogleOneTap />
          </div>

          <div className="text-center text-xs text-gray-400 mt-6">
            <p>
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
