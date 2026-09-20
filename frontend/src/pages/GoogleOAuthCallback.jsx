import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import emailReceiptService from '../services/emailReceiptService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { CheckCircle2, AlertCircle, Mail } from 'lucide-react';

export const GoogleOAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [errorMsg, setErrorMsg] = useState('');
  const [connectedEmail, setConnectedEmail] = useState('');

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        setStatus('error');
        if (error === 'access_denied') {
          setErrorMsg(
            'Google Access Blocked (Error 403: access_denied)\n\n' +
            'Your Google Cloud OAuth app is currently in Testing Mode. In Testing Mode, Google requires that any account signing in must be explicitly listed as a Test User.\n\n' +
            'Resolution Steps:\n' +
            '1. Open Google Cloud Console (console.cloud.google.com)\n' +
            '2. Navigate to APIs & Services > OAuth consent screen (or Google Auth Platform > Audience)\n' +
            '3. Under "Test users", click "+ ADD USERS"\n' +
            '4. Enter the Gmail address you are trying to connect and click Save\n' +
            '5. Return to LifeReceipt and click "Connect Gmail Account" again.'
          );
        } else {
          setErrorMsg(`Google authorization was cancelled or denied: ${error}`);
        }
        return;
      }

      if (!code) {
        setStatus('error');
        setErrorMsg('No authorization code was received from Google.');
        return;
      }

      try {
        const redirectUri = `${window.location.origin}/oauth/google/callback`;
        const result = await emailReceiptService.exchangeGoogleCode(code, redirectUri);
        if (result.success) {
          setConnectedEmail(result.data?.emailAddress || 'your Google account');
          setStatus('success');
          setTimeout(() => {
            navigate('/email-receipts', {
              state: { message: `Gmail connected successfully: ${result.data?.emailAddress}` },
            });
          }, 2000);
        } else {
          throw new Error(result.message || 'Failed to exchange Google OAuth code');
        }
      } catch (err) {
        setStatus('error');
        setErrorMsg(err.response?.data?.message || err.message || 'Failed to complete Google authentication');
      }
    };

    processCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center mx-auto">
          <Mail className="w-7 h-7" />
        </div>

        {status === 'processing' && (
          <div className="space-y-4">
            <LoadingSpinner size="lg" label="Connecting your genuine Google account..." />
            <p className="text-xs text-slate-400">
              Exchanging authorization credentials with Google and securing tokens with AES-256 encryption.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-3">
            <div className="flex items-center justify-center text-emerald-400 gap-2">
              <CheckCircle2 className="w-6 h-6" />
              <h2 className="text-lg font-bold text-slate-100">Gmail Connected!</h2>
            </div>
            <p className="text-sm text-slate-300">
              Successfully authorized <span className="font-semibold text-white">{connectedEmail}</span>.
            </p>
            <p className="text-xs text-slate-400">
              Redirecting you to your Email Receipt Intelligence dashboard...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="flex items-center justify-center text-rose-400 gap-2">
              <AlertCircle className="w-6 h-6" />
              <h2 className="text-lg font-bold text-slate-100">Connection Failed</h2>
            </div>
            <p className="text-sm text-rose-300/90 bg-rose-500/10 p-4 rounded-xl border border-rose-500/20 text-left whitespace-pre-line">
              {errorMsg}
            </p>
            <div className="pt-2 flex gap-3 justify-center">
              <Button variant="primary" onClick={() => navigate('/email-receipts')}>
                Return to Email Receipts
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default GoogleOAuthCallback;
