import { useSelector } from 'react-redux';

export function useAuth() {
  const auth = useSelector((state) => state.auth);
  const user = auth?.user || null;
  const derivedTier = user?.subscription_tier || user?.subscriptionTier || (user?.isPremium ? 'premium' : 'free');

  return {
    ...auth,
    user: user ? { ...user, subscription_tier: derivedTier } : user,
  };
}

