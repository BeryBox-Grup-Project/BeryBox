import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowsLeftRight, Buildings, MapPin, Package, Star } from '@phosphor-icons/react';
import { Card, Badge } from './ui/Card';
import { Avatar } from './ui/Avatar';
import { CATEGORY_LABELS, CONDITION_LABELS, STATUS_LABELS, TYPE_LABELS, formatDistance, isUnsplash } from '../lib/labels';

function ItemImage({ src, alt, label, dimmed = false }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-surface-container-low">
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${dimmed ? 'opacity-80' : ''}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-primary">
          <Package size={40} weight="duotone" />
        </div>
      )}
      {label && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
          <span className="font-label line-clamp-1 text-[11px] text-white drop-shadow-md">{label}</span>
        </div>
      )}
    </div>
  );
}

export function ItemCard({ item, index = 0 }) {
  const isBarter = item.type === 'barter';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.06, duration: 0.35 }}
      whileHover={{ y: -4 }}
    >
      <Card className={`group flex h-full flex-col p-3 ${isBarter ? 'border-primary/20' : ''}`}>
        <Link to={`/items/${item.id}`} className="flex h-full flex-col">
          <div className="relative mb-3 aspect-[4/3] w-full overflow-hidden rounded-2xl bg-surface-container-low">
            {isBarter ? (
              <div className="flex h-full w-full">
                <div className="w-1/2 border-r border-white">
                  <ItemImage src={item.imageUrl} alt={item.title} label={`Punya: ${item.title}`} />
                </div>
                <div className="w-1/2">
                  <ItemImage
                    src={item.wantedImageUrl}
                    alt={item.wantedTitle || 'Barang yang dicari'}
                    label={`Mau: ${item.wantedTitle || 'Belum diisi'}`}
                    dimmed
                  />
                </div>
                <span className="absolute left-1/2 top-1/2 z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-surface-container-lowest bg-primary text-on-primary shadow-md">
                  <ArrowsLeftRight size={14} weight="bold" />
                </span>
              </div>
            ) : (
              <ItemImage src={item.imageUrl} alt={item.title} />
            )}
            <span className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-surface-container-lowest/90 px-2.5 py-1 text-xs shadow-sm backdrop-blur-sm">
              <span className={`h-2 w-2 rounded-full ${isBarter ? 'bg-secondary' : 'bg-tertiary'}`} />
              <span className="font-label text-on-surface">{TYPE_LABELS[item.type]}</span>
            </span>
            {item.status && item.status !== 'available' && (
              <span className="font-label absolute right-2 top-2 z-10 rounded-full bg-surface-container-lowest/90 px-2.5 py-1 text-[10px] text-on-surface shadow-sm backdrop-blur-sm">
                {STATUS_LABELS[item.status] || item.status}
              </span>
            )}
            {item.pendingClaimCount > 0 && (
              <span className="font-label absolute right-2 top-2 z-10 rounded-full bg-primary/90 px-2.5 py-1 text-[10px] text-on-primary">
                {item.pendingClaimCount} peminat
              </span>
            )}
          </div>

          <div className="flex flex-1 flex-col px-1">
            <div className="mb-1 flex items-start justify-between gap-2">
              <h3 className="font-headline line-clamp-2 text-base leading-tight text-on-surface">
                {isBarter && item.wantedTitle ? `${item.title} utk ${item.wantedTitle}` : item.title}
              </h3>
              <span className="font-label ml-1 whitespace-nowrap rounded-md bg-surface-container px-2 py-0.5 text-[10px] text-primary">
                {CONDITION_LABELS[item.condition]}
              </span>
            </div>

            <div className="mb-3 mt-auto flex items-center gap-1 pt-2 text-sm text-on-surface-variant">
              <MapPin size={14} className="shrink-0" />
              <span className="line-clamp-1">{item.addressLabel || 'Lokasi disembunyikan'}</span>
              {item.distanceKm != null && (
                <>
                  <span className="mx-1 h-1 w-1 rounded-full bg-outline-variant" />
                  <span>{formatDistance(item.distanceKm)}</span>
                </>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-outline-variant/30 pt-3">
              <div className="flex items-center gap-2">
                <Avatar src={item.owner?.photoUrl} name={item.owner?.username} size="sm" />
                <span className="font-label text-xs text-on-surface">{item.owner?.username}</span>
                {item.owner?.ratingAvg > 0 && (
                  <span className="flex items-center gap-0.5 text-xs text-on-surface-variant">
                    <Star size={12} weight="fill" /> {item.owner.ratingAvg.toFixed(1)}
                  </span>
                )}
              </div>
              <Badge tone="neutral" className="text-[10px]">{CATEGORY_LABELS[item.category]}</Badge>
            </div>
          </div>
        </Link>
      </Card>
    </motion.div>
  );
}

export function BarterMatcherCard({ index = 0, onClick }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.06, duration: 0.35 }}
      whileHover={{ y: -4 }}
    >
      <Card className="group flex h-full flex-col border-primary/30 p-3">
        <button type="button" onClick={onClick} className="flex h-full flex-col text-left">
          <div className="relative mb-3 flex aspect-[4/3] w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-primary text-on-primary">
            <ArrowsLeftRight size={48} weight="bold" />
            <span className="font-label mt-2 text-sm">AI Matcher</span>
            <span className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-surface-container-lowest/90 px-2.5 py-1 text-xs shadow-sm backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-secondary" />
              <span className="font-label text-on-surface">Barter</span>
            </span>
          </div>
          <div className="flex flex-1 flex-col px-1">
            <h3 className="font-headline line-clamp-2 text-base leading-tight text-on-surface">
              AI matcher barter
            </h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              Tulis barang punya dan yang dicari. Klik untuk membuka form.
            </p>
          </div>
        </button>
      </Card>
    </motion.div>
  );
}

export function OrganizationCard({ organization, index = 0, compact = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.06, duration: 0.35 }}
      whileHover={{ y: -4 }}
    >
      <Card className={`overflow-hidden ${compact ? 'p-3' : 'p-4'}`}>
        <Link to={`/organizations/${organization.id}`} state={{ organization }} className={compact ? 'flex gap-3' : 'block'}>
          <div
            className={`relative shrink-0 overflow-hidden rounded-2xl bg-surface-container-low ${
              compact ? 'h-24 w-24' : 'mb-4 aspect-[3/2] w-full'
            }`}
          >
            {organization.photoUrl ? (
              <img
                src={organization.photoUrl}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover object-center"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-primary">
                <Buildings size={compact ? 28 : 40} weight="duotone" />
              </div>
            )}
            {organization.distanceKm != null && (
              <span
                className={`font-label absolute flex items-center gap-1 rounded-full bg-surface/90 text-xs text-on-surface shadow-sm backdrop-blur-sm ${
                  compact ? 'right-1 top-1 px-1.5 py-0.5' : 'right-3 top-3 px-2.5 py-1'
                }`}
              >
                <MapPin size={12} /> {formatDistance(organization.distanceKm)}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-start justify-between gap-2">
              <h3 className="font-headline line-clamp-2 text-base leading-tight text-on-surface md:text-lg">
                {organization.name}
              </h3>
              {organization.verified === 'approved' && <Badge tone="success">Terverifikasi</Badge>}
              {organization.verified !== 'approved' && (
                <Badge tone="warning">{organization.verified === 'pending' ? 'Menunggu' : 'Belum terverifikasi'}</Badge>
              )}
            </div>
            <p className={`text-sm text-on-surface-variant ${compact ? 'line-clamp-2' : 'line-clamp-2'}`}>
              {organization.description}
            </p>
            <p className="mt-2 flex items-center gap-1 text-xs text-on-surface-variant">
              <MapPin size={12} className="shrink-0" />
              <span className="line-clamp-1">{organization.addressLabel}</span>
            </p>
            {isUnsplash(organization.photoUrl) && (
              <p className="mt-1 text-[11px] text-on-surface-variant">Foto ilustrasi Unsplash</p>
            )}
          </div>
        </Link>
      </Card>
    </motion.div>
  );
}
