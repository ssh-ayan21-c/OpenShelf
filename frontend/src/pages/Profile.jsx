import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { fetchMe } from '../store/slices/authSlice';
import { User, Mail, Phone, MapPin, Shield, Crown, Edit, Check, X, RefreshCw, Trash2, Camera } from 'lucide-react';

export default function Profile() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [editing, setEditing] = useState(false);
  
  const [form, setForm] = useState({ 
    name: user?.name || '', 
    phone: user?.phone || '', 
    address: user?.address || '',
    avatarUrl: user?.avatarUrl || ''
  });

  const getRankData = (count, role) => {
    if (role === 'ADMIN') return null;
    const c = count || 0;
    if (c <= 2) return { title: 'Vidyarthi (Student)', colors: 'from-slate-400 to-gray-500', badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };
    if (c <= 5) return { title: 'Jigyasu (Curious)', colors: 'from-cyan-400 to-blue-500', badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' };
    if (c <= 10) return { title: 'Gyani (Knowledgeable)', colors: 'from-emerald-400 to-teal-500', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
    if (c <= 20) return { title: 'Vidwan (Scholar)', colors: 'from-purple-400 to-indigo-500', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
    return { title: 'Rishi (Sage)', colors: 'from-amber-400 to-orange-500', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
  };

  const rank = getRankData(user?.borrowedCount, user?.role);

  const handleSave = async () => {
    try {
      await api.put('/users/update-profile', form);
      toast.success('Profile updated successfully!');
      dispatch(fetchMe());
      setEditing(false);
    } catch (err) { 
      toast.error(err.response?.data?.message || 'Failed to update profile'); 
    }
  };

  const generateAIAvatar = () => {
    const seed = user?.id || Math.random().toString(36).substring(7);
    setForm({ ...form, avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}` });
  };

  const removePhoto = () => {
    setForm({ ...form, avatarUrl: '' });
  };

  if (!user) return <div className="text-center py-20">Loading profile...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      {/* Rank Presentation Banner */}
      {rank && (
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${rank.colors} p-8 flex items-center justify-between shadow-2xl`}>
          <div className="absolute inset-0 bg-black/20 mix-blend-overlay"></div>
          <div className="relative z-10 text-white space-y-1">
            <p className="text-sm font-medium uppercase tracking-wider opacity-90">Current Level</p>
            <h1 className="text-4xl font-extrabold drop-shadow-md">{rank.title}</h1>
            <p className="text-sm opacity-95 pt-2">Based on {user.borrowedCount || 0} books actively borrowed</p>
          </div>
          <div className="relative z-10 hidden sm:block">
            <Crown className="w-20 h-20 text-white/20" />
          </div>
        </div>
      )}

      <div className="glass-card p-6 md:p-8 space-y-8">
        {/* User Identity Section */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="relative group">
            <div className={`w-28 h-28 rounded-full border-4 border-gray-800 bg-gray-900 flex items-center justify-center overflow-hidden shadow-xl`}>
              {(editing ? form.avatarUrl : user.avatarUrl) ? (
                <img src={editing ? form.avatarUrl : user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-gray-500" />
              )}
            </div>
          </div>
          
          <div className="flex-1 text-center md:text-left space-y-2">
            <h2 className="text-2xl font-bold text-gray-100 flex items-center justify-center md:justify-start gap-3">
              {user.name}
            </h2>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-2">
              {rank && (
                <span className={`border ${rank.badge} px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center`}>
                  <Crown className="w-3 h-3 mr-1" /> {rank.title.split(' ')[0]}
                </span>
              )}
              <span className={`badge ${user.role === 'ADMIN' ? 'badge-info' : 'badge-neutral'}`}>
                <Shield className="w-3 h-3 mr-1 inline" />{user.role}
              </span>
              {user.isPremium && <span className="badge badge-warning"><Crown className="w-3 h-3 mr-1 inline" />Premium</span>}
            </div>
            <p className="text-gray-400 text-sm mt-1">Joined {new Date(user.createdAt).toLocaleDateString()}</p>
          </div>

          {!editing && (
            <button onClick={() => setEditing(true)} className="btn-secondary whitespace-nowrap self-start md:self-center">
              <Edit className="w-4 h-4 mr-2 inline" /> Edit Profile
            </button>
          )}
        </div>

        <div className="h-px w-full bg-gray-800/50"></div>

        {/* User Details Form/View */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-800/30 rounded-xl border border-gray-700/30 flex items-start gap-3">
              <Mail className="w-5 h-5 text-gray-500 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 font-medium pb-1">Email (Unchangeable)</p>
                <p className="text-gray-300 font-medium">{user.email}</p>
              </div>
            </div>

            <div className="p-4 bg-gray-800/30 rounded-xl border border-gray-700/30 flex items-start gap-3">
              <Phone className="w-5 h-5 text-gray-500 mt-0.5" />
              <div className="w-full">
                <p className="text-xs text-gray-500 font-medium pb-1">Phone Number</p>
                {editing ? (
                  <input className="input-field mt-1 py-1 px-2 text-sm w-full" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Add phone" />
                ) : (
                  <p className="text-gray-300 font-medium">{user.phone || 'Not set'}</p>
                )}
              </div>
            </div>

            <div className="p-4 bg-gray-800/30 rounded-xl border border-gray-700/30 flex items-start gap-3 md:col-span-2">
              <MapPin className="w-5 h-5 text-gray-500 mt-0.5" />
              <div className="w-full">
                <p className="text-xs text-gray-500 font-medium pb-1">Address</p>
                {editing ? (
                  <input className="input-field mt-1 py-1 px-2 text-sm w-full" value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Add address" />
                ) : (
                  <p className="text-gray-300 font-medium">{user.address || 'Not set'}</p>
                )}
              </div>
            </div>
            
            {editing && (
              <div className="p-4 bg-gray-800/30 rounded-xl border border-gray-700/30 md:col-span-2 space-y-4">
                <div>
                  <p className="text-xs text-gray-500 font-medium pb-2"><User className="w-4 h-4 inline mr-1" /> Profile Name</p>
                  <input className="input-field py-1.5 px-3 w-full" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                </div>
                
                <div className="pt-2 border-t border-gray-700/30">
                  <p className="text-xs text-gray-500 font-medium pb-2"><Camera className="w-4 h-4 inline mr-1" /> Avatar Photo URL</p>
                  <div className="flex gap-2">
                    <input className="input-field py-1.5 px-3 flex-1" placeholder="https://..." value={form.avatarUrl} onChange={e => setForm({...form, avatarUrl: e.target.value})} />
                    <button onClick={generateAIAvatar} title="Generate AI Avatar" type="button" className="p-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors">
                      <RefreshCw className="w-5 h-5" />
                    </button>
                    <button onClick={removePhoto} title="Remove Photo" type="button" className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {editing && (
            <div className="flex gap-3 justify-end pt-4 border-t border-gray-800/60 mt-4">
              <button onClick={() => setEditing(false)} className="btn-secondary flex items-center"><X className="w-4 h-4 mr-1"/> Cancel</button>
              <button onClick={handleSave} className="btn-primary flex items-center"><Check className="w-4 h-4 mr-1"/> Save Changes</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
