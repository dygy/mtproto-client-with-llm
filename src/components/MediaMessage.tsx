// @ts-nocheck
import React, { useState, useRef } from 'react';
import { Play, Download, FileText, Image, File } from 'lucide-react';
import Lottie from 'lottie-react';

interface MediaMessageProps {
  sessionId: string;
  chatId: number | string;
  messageId: number;
  mediaType?: string;
  mediaInfo?: any;
  text?: string;
  className?: string;
}

const MediaMessage: React.FC<MediaMessageProps> = ({
  sessionId,
  chatId,
  messageId,
  mediaType,
  text,
  className = ''
}) => {
  // Return null if no mediaType is provided
  if (!mediaType) {
    return null;
  }

  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const getMediaUrl = (thumbnail = false) => {
    const params = thumbnail ? '?thumbnail=true' : '';
    const url = `/api/media/${sessionId}/${chatId}/${messageId}${params}`;
    return url;
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = getMediaUrl(false);
    link.download = `media_${messageId}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleVideoPlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleAudioPlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const renderPhotoMessage = () => (
    <div className={`relative group ${className}`}>
      <div className="relative overflow-hidden rounded-lg max-w-sm">
        {!imageLoaded && !imageError && (
          <div className="w-64 h-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg flex items-center justify-center">
            <Image className="w-8 h-8 text-gray-400" />
          </div>
        )}
        
        {!imageError && (
          <img
            src={getMediaUrl(true)} // Use thumbnail for initial display
            alt="Photo"
            className={`max-w-full h-auto cursor-pointer transition-opacity ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            onClick={() => setShowFullImage(true)}
            loading="lazy"
          />
        )}
        
        {imageError && (
          <div className="w-64 h-48 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
            <div className="text-center text-gray-500">
              <Image className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">Failed to load image</p>
            </div>
          </div>
        )}

        {/* Download button overlay */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            className="p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors"
            title="Download image"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {text && (
        <p className="mt-2 text-sm">{text}</p>
      )}

      {/* Full image modal */}
      {showFullImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
          onClick={() => setShowFullImage(false)}
        >
          <div className="relative max-w-full max-h-full p-4">
            <img
              src={getMediaUrl(false)} // Full resolution
              alt="Photo"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setShowFullImage(false)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 text-2xl"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderVideoMessage = () => (
    <div className={`relative group ${className}`}>
      <div className="relative overflow-hidden rounded-lg max-w-sm">
        <video
          ref={videoRef}
          className="max-w-full h-auto"
          poster={getMediaUrl(true)} // Use thumbnail as poster
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          controls
        >
          <source src={getMediaUrl(false)} />
          Your browser does not support the video tag.
        </video>

        {/* Play button overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={handleVideoPlay}
              className="p-4 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors"
            >
              <Play className="w-8 h-8" />
            </button>
          </div>
        )}

        {/* Download button */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleDownload}
            className="p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors"
            title="Download video"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {text && (
        <p className="mt-2 text-sm">{text}</p>
      )}
    </div>
  );

  const renderAudioMessage = () => (
    <div className={`relative bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-2xl p-4 max-w-sm ${className}`}>
      <div className="flex items-center space-x-3">
        {/* Play/Pause Button */}
        <button
          onClick={handleAudioPlay}
          className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center group"
        >
          {isPlaying ? (
            <div className="w-4 h-4 bg-white rounded-sm"></div>
          ) : (
            <Play className="w-5 h-5 ml-0.5 group-hover:scale-110 transition-transform" />
          )}
        </button>

        {/* Audio Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-1 h-1 bg-blue-300 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Voice Message</span>
          </div>

          {/* Custom Audio Controls */}
          <div className="space-y-2">
            <audio
              ref={audioRef}
              className="hidden"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              onTimeUpdate={(e) => {
                const audio = e.target as HTMLAudioElement;
                const progress = (audio.currentTime / audio.duration) * 100;
                const progressBar = document.getElementById(`progress-${messageId}`);
                if (progressBar) {
                  progressBar.style.width = `${progress}%`;
                }
              }}
            >
              <source src={getMediaUrl(false)} />
              Your browser does not support the audio tag.
            </audio>

            {/* Progress Bar */}
            <div className="relative h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <div
                id={`progress-${messageId}`}
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-100"
                style={{ width: '0%' }}
              ></div>
            </div>

            {/* Duration */}
            <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
              <span id={`duration-${messageId}`}>0:00</span>
              <button
                onClick={handleDownload}
                className="p-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title="Download audio"
              >
                <Download className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {text && (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{text}</p>
      )}
    </div>
  );

  const renderDocumentMessage = () => (
    <div className={`flex items-center space-x-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg ${className}`}>
      <div className="p-2 bg-gray-300 dark:bg-gray-600 rounded">
        <FileText className="w-6 h-6 text-gray-600 dark:text-gray-300" />
      </div>
      
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Document</span>
          <button
            onClick={handleDownload}
            className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            title="Download document"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
        {text && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{text}</p>
        )}
      </div>
    </div>
  );

  const renderStickerMessage = () => {
    const [isLottie, setIsLottie] = useState(false);
    const [lottieData, setLottieData] = useState(null);

    // Check if this is a Lottie sticker by trying to fetch and parse as JSON
    React.useEffect(() => {
      const checkLottie = async () => {
        try {
          const response = await fetch(getMediaUrl(false));
          const contentType = response.headers.get('content-type');

          if (contentType?.includes('application/json') || contentType?.includes('text/plain')) {
            const data = await response.json();
            if (data && (data.v || data.tgs)) { // Lottie format indicators
              setLottieData(data);
              setIsLottie(true);
              return;
            }
          }
        } catch (error) {
          // Not a Lottie file, fall back to regular image
          console.log('Not a Lottie sticker, using regular image');
        }
      };

      checkLottie();
    }, []);

    return (
      <div className={`${className}`}>
        <div className="relative inline-block">
          {isLottie && lottieData ? (
            // Render Lottie animation
            <div className="w-32 h-32">
              <Lottie
                animationData={lottieData}
                loop={true}
                autoplay={true}
                style={{ width: '128px', height: '128px' }}
              />
            </div>
          ) : (
            // Render regular sticker
            <>
              {!imageLoaded && !imageError && (
                <div className="w-32 h-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg flex items-center justify-center">
                  <Image className="w-8 h-8 text-gray-400" />
                </div>
              )}

              {!imageError && !isLottie && (
                <img
                  src={getMediaUrl(false)}
                  alt="Sticker"
                  className={`max-w-32 h-auto transition-opacity ${
                    imageLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                  loading="lazy"
                />
              )}

              {imageError && (
                <div className="w-32 h-32 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <Image className="w-6 h-6 mx-auto mb-1" />
                    <p className="text-xs">Sticker</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const renderDefaultMedia = () => (
    <div className={`flex items-center space-x-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg ${className}`}>
      <div className="p-2 bg-gray-300 dark:bg-gray-600 rounded">
        <File className="w-6 h-6 text-gray-600 dark:text-gray-300" />
      </div>
      
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Media File</span>
          <button
            onClick={handleDownload}
            className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            title="Download file"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
        {text && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{text}</p>
        )}
      </div>
    </div>
  );

  // Render appropriate media type
  switch (mediaType) {
    case 'photo':
      return renderPhotoMessage();
    case 'video':
      return renderVideoMessage();
    case 'audio':
      return renderAudioMessage();
    case 'document':
      return renderDocumentMessage();
    case 'sticker':
      return renderStickerMessage();
    case 'gif':
      return renderVideoMessage(); // GIFs are handled like videos
    default:
      return renderDefaultMedia();
  }
};

export default MediaMessage;
