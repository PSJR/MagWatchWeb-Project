import { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Upload, Download, Users } from 'lucide-react';
import { formatDuration, formatBytes } from '@/utils';
import subsrt from 'subtitles-parser';

export default function VideoPlayer({ videoUrl, torrent, fileName }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffered, setBuffered] = useState(0);
  const [torrentStats, setTorrentStats] = useState({ downloadSpeed: 0, uploadSpeed: 0, numPeers: 0, progress: 0 });
  const [subtitles, setSubtitles] = useState([]);
  const [currentSubtitle, setCurrentSubtitle] = useState(null);
  
  const controlsTimeoutRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current || !videoUrl) return;
    
    videoRef.current.src = videoUrl;
    videoRef.current.load();
  }, [videoUrl]);

  useEffect(() => {
    if (!torrent) return;

    const updateStats = () => {
      setTorrentStats({
        downloadSpeed: torrent.downloadSpeed,
        uploadSpeed: torrent.uploadSpeed,
        numPeers: torrent.numPeers,
        progress: torrent.progress
      });
    };

    const interval = setInterval(updateStats, 1000);
    return () => clearInterval(interval);
  }, [torrent]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        setBuffered((bufferedEnd / video.duration) * 100);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('progress', handleProgress);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('progress', handleProgress);
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (subtitles.length === 0) return;

    const currentSub = subtitles.find(
      sub => currentTime >= sub.startTime / 1000 && currentTime <= sub.endTime / 1000
    );
    setCurrentSubtitle(currentSub?.text || null);
  }, [currentTime, subtitles]);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const time = pos * duration;
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      videoRef.current.muted = newMuted;
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const handleSubtitleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target.result;
        let parsed;

        if (file.name.endsWith('.srt')) {
          parsed = subsrt.fromSrt(content, true);
        } else if (file.name.endsWith('.vtt')) {
          parsed = subsrt.fromVtt(content, true);
        }

        if (parsed && parsed.length > 0) {
          setSubtitles(parsed);
        }
      } catch (err) {
        console.error('Erro ao carregar legendas:', err);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      ref={containerRef}
      className="relative bg-black rounded-xl overflow-hidden aspect-video group"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      data-testid="video-player-container"
    >
      <video
        ref={videoRef}
        className="w-full h-full"
        onClick={handlePlayPause}
        data-testid="video-element"
      />

      {currentSubtitle && (
        <div className="absolute bottom-20 left-0 right-0 text-center px-4">
          <div className="inline-block bg-black/80 px-4 py-2 rounded text-white text-lg font-medium">
            {currentSubtitle}
          </div>
        </div>
      )}

      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 transition-opacity duration-300 pointer-events-none ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        className={`absolute bottom-0 left-0 right-0 p-4 transition-all duration-300 ${
          showControls ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
      >
        {torrent && (
          <div className="flex items-center gap-4 text-xs text-white/80 mb-3">
            <div className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              <span>{formatBytes(torrentStats.downloadSpeed)}/s</span>
            </div>
            <div className="flex items-center gap-1">
              <Upload className="w-3 h-3" />
              <span>{formatBytes(torrentStats.uploadSpeed)}/s</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>{torrentStats.numPeers} peers</span>
            </div>
            <div className="flex-1 text-right">
              <span>Buffer: {Math.round(torrentStats.progress * 100)}%</span>
            </div>
          </div>
        )}

        <div className="relative w-full h-1 bg-white/20 rounded-full cursor-pointer mb-4" onClick={handleSeek}>
          <div
            className="absolute top-0 left-0 h-full bg-blue-500/30 rounded-full"
            style={{ width: `${buffered}%` }}
          />
          <div
            className="absolute top-0 left-0 h-full bg-blue-500 rounded-full"
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handlePlayPause}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              data-testid="play-pause-btn"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="text-white hover:text-blue-400 transition-colors">
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="w-20 accent-blue-500"
              />
            </div>

            <div className="text-white text-sm font-medium">
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="cursor-pointer text-white hover:text-blue-400 transition-colors">
              <input
                type="file"
                accept=".srt,.vtt"
                onChange={handleSubtitleUpload}
                className="hidden"
              />
              <Upload className="w-5 h-5" />
            </label>

            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-blue-400 transition-colors"
              data-testid="fullscreen-btn"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
