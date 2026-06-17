import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Bookmark, MapPin, ArrowLeft, Clock, Footprints, TrainFront, Car, Star, Navigation, X, Users, Volume2 } from 'lucide-react';
import { mockQuietPlaces } from '../data/mockQuietPlaces';
import { getTransitTimes, getCrowdednessText, getCrowdednessColor, getTypeColor, getTypeLabel, formatRating } from '../lib/utils';

interface PlaceDetailProps {
  favorites: string[];
  saved: string[];
  onToggleFavorite: (id: string) => void;
  onToggleSaved: (id: string) => void;
  onRecordView?: (id: string) => void;
}

export default function PlaceDetail({ favorites, saved, onToggleFavorite, onToggleSaved, onRecordView }: PlaceDetailProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const place = mockQuietPlaces.find((p) => p.id === id);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    if (id) onRecordView?.(id);
  }, [id, onRecordView]);

  if (!place) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-slate-50 p-6 dark:bg-slate-900">
        <p className="text-slate-500 dark:text-slate-400">Place not found</p>
        <button onClick={() => navigate('/')} className="mt-4 text-teal-600">Go back</button>
      </div>
    );
  }

  const { walkMin, subwayMin, driveMin } = getTransitTimes(place.distance);
  const occupancy = Math.round((place.currentPeople / place.totalCapacity) * 100);
  const isFavorite = favorites.includes(place.id);
  const isSaved = saved.includes(place.id);
  const photos = place.photos && place.photos.length > 0 ? place.photos : ['https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80'];

  const nextPhoto = () => setPhotoIndex((i) => (i + 1) % photos.length);
  const prevPhoto = () => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      className="flex h-full flex-col overflow-y-auto bg-white pb-24 dark:bg-slate-900"
    >
      {/* Photo carousel */}
      <div className="relative h-64 w-full shrink-0">
        <AnimatePresence mode="wait">
          <motion.img
            key={photoIndex}
            src={photos[photoIndex]}
            alt={place.name}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </AnimatePresence>
        <button
          onClick={() => navigate(-1)}
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="absolute right-4 top-4 flex gap-2">
          <button
            onClick={() => onToggleFavorite(place.id)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm"
          >
            <Heart size={20} className={isFavorite ? 'fill-rose-500 text-rose-500' : ''} />
          </button>
          <button
            onClick={() => onToggleSaved(place.id)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm"
          >
            <Bookmark size={20} className={isSaved ? 'fill-amber-400 text-amber-400' : ''} />
          </button>
        </div>
        <button onClick={prevPhoto} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/20 p-1 text-white">
          <ArrowLeft size={18} />
        </button>
        <button onClick={nextPhoto} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/20 p-1 text-white">
          <X size={18} className="rotate-45" />
        </button>
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setPhotoIndex(i)}
              className={`h-1.5 rounded-full transition-all ${i === photoIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-4 p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold text-white ${getTypeColor(place.type)}`}>
              {getTypeLabel(place.type)}
            </span>
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${getCrowdednessColor(place.crowdedness)}`}>
              {getCrowdednessText(place.crowdedness)}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-800 dark:text-slate-100">{place.name}</h1>
          <div className="mt-1 flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
            <MapPin size={14} />
            <span>{place.address}</span>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="flex flex-col items-center rounded-2xl bg-teal-50 p-3 dark:bg-teal-950/20">
            <Volume2 size={16} className="text-teal-600 dark:text-teal-400" />
            <span className="mt-1 text-lg font-extrabold text-teal-700 dark:text-teal-300">{place.quietScore}</span>
            <span className="text-[9px] text-teal-600 dark:text-teal-400">Quiet</span>
          </div>
          <div className="flex flex-col items-center rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">
            <Users size={16} className="text-slate-400" />
            <span className="mt-1 text-lg font-extrabold text-slate-700 dark:text-slate-200">{occupancy}%</span>
            <span className="text-[9px] text-slate-500 dark:text-slate-400">Full</span>
          </div>
          <div className="flex flex-col items-center rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">
            <Star size={16} className="fill-amber-400 text-amber-400" />
            <span className="mt-1 text-lg font-extrabold text-slate-700 dark:text-slate-200">{formatRating(place)}</span>
            <span className="text-[9px] text-slate-500 dark:text-slate-400">Rating</span>
          </div>
          <div className="flex flex-col items-center rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">
            <Clock size={16} className="text-slate-400" />
            <span className="mt-1 text-sm font-extrabold text-slate-700 dark:text-slate-200">{place.hours.split(' ')[0]}</span>
            <span className="text-[9px] text-slate-500 dark:text-slate-400">Opens</span>
          </div>
        </div>

        {/* Transit times */}
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Getting there</h3>
          <div className="mt-3 flex justify-between">
            <div className="flex flex-col items-center gap-1">
              <Footprints size={18} className="text-slate-400" />
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{walkMin} min</span>
              <span className="text-[9px] text-slate-400">Walk</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <TrainFront size={18} className="text-slate-400" />
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{subwayMin} min</span>
              <span className="text-[9px] text-slate-400">Subway</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Car size={18} className="text-slate-400" />
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{driveMin} min</span>
              <span className="text-[9px] text-slate-400">Drive</span>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tags</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {place.tags.map((tag) => (
              <span key={tag} className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Hours */}
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Hours</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{place.hours}</p>
        </div>

        {/* Reviews */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Reviews</h3>
          <div className="mt-2 flex flex-col gap-3">
            {place.reviews.map((review, i) => (
              <div key={i} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-teal-400 text-xs font-bold text-white">
                      {review.author[0]}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{review.author}</p>
                      <p className="text-[10px] text-slate-400">{review.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Star size={12} className="fill-amber-400 text-amber-400" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{review.rating}</span>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{review.comment}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Directions button */}
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl bg-slate-800 py-3.5 text-sm font-bold text-white shadow-sm active:bg-slate-700 dark:bg-white dark:text-slate-800 dark:active:bg-slate-200"
        >
          <Navigation size={16} />
          Get Directions on Google Maps
        </a>
      </div>
    </motion.div>
  );
}
