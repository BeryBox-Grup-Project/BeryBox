import { MapPin, Star } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { authApi } from '../api';
import { apiMessage } from '../api/http';
import { Card, Badge } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState, Skeleton, Stars } from '../components/ui/Feedback';
import { useUi } from '../context/UiContext';

export default function UserProfilePage() {
  const { id } = useParams();
  const { toast } = useUi();
  const [user, setUser] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([authApi.user(id), authApi.userReviews(id)])
      .then(([profile, rows]) => {
        setUser(profile);
        setReviews(Array.isArray(rows) ? rows : []);
      })
      .catch((error) => toast(apiMessage(error), 'error'))
      .finally(() => setLoading(false));
  }, [id, toast]);

  if (loading) return <Skeleton className="h-56 w-full" />;
  if (!user) return <EmptyState title="Pengguna tidak ditemukan" />;

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/home" className="font-label mb-4 inline-block text-sm text-on-surface-variant hover:text-primary">
        ← Kembali
      </Link>
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <Avatar src={user.photoUrl} name={user.username} size="2xl" />
          <div>
            <h1 className="font-headline text-2xl text-on-surface">{user.username}</h1>
            <p className="flex items-center gap-1 text-sm text-on-surface-variant">
              <MapPin size={14} /> {user.addressLabel}
            </p>
            <div className="mt-2 flex gap-2">
              <Badge className="inline-flex items-center gap-1">
                <Star size={12} weight="fill" /> {(user.ratingAvg || 0).toFixed(1)}
              </Badge>
              <Badge tone="neutral">{user.role}</Badge>
            </div>
          </div>
        </div>
      </Card>

      <h2 className="font-headline mb-stack-md mt-stack-lg text-lg text-on-surface">Ulasan</h2>
      {reviews.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Belum ada ulasan.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <Card key={review.id} className="p-4">
              <Stars value={review.rating} readOnly size="text-base" />
              <p className="mt-2 text-sm text-on-surface">{review.comment}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
