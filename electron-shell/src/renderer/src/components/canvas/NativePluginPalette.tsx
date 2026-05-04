import React, { useState } from 'react'

// ─────────────────────────────────────────────────────────
// NATIVE PLUGIN DEFINITIONS
// ─────────────────────────────────────────────────────────

export interface NativePlugin {
  id:          string
  name:        string
  icon:        string
  category:    string
  pubPackage:  string
  version:     string
  description: string
  platforms:   ('android' | 'ios')[]
  // Dart code scaffold generated into the screen's .dart file
  dartSnippet: string
  // Dart widget dropped onto the canvas
  widgetType:  string
  widgetProps: Record<string, unknown>
  // pubspec.yaml dependency
  dependency:  string
}

export const NATIVE_PLUGINS: NativePlugin[] = [

  // ── Camera ──────────────────────────────────────────
  {
    id: 'camera', name: 'Camera', icon: '📷', category: 'Media',
    pubPackage: 'image_picker', version: '^1.0.7',
    description: 'Photo capture & gallery picker (camera_roll, photo library)',
    platforms: ['android', 'ios'],
    dependency: 'image_picker: ^1.0.7',
    widgetType: 'flutter.widgets.native.Camera',
    widgetProps: { label: 'Camera / Gallery', icon: 'Icons.camera_alt' },
    dartSnippet: `
  // ── Camera / Gallery ─────────────────────────────────
  final ImagePicker _picker = ImagePicker();
  XFile? _pickedImage;

  Future<void> pickImageFromCamera() async {
    final XFile? image = await _picker.pickImage(
      source: ImageSource.camera,
      maxWidth: 1920, maxHeight: 1920, imageQuality: 85,
    );
    if (image != null) {
      _pickedImage = image;
      // TODO: handle image — upload, display, process
    }
  }

  Future<void> pickImageFromGallery() async {
    final XFile? image = await _picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1920, maxHeight: 1920, imageQuality: 85,
    );
    if (image != null) {
      _pickedImage = image;
      // TODO: handle image
    }
  }

  // Required Android permissions (add to AndroidManifest.xml):
  // <uses-permission android:name="android.permission.CAMERA"/>
  // Required iOS (add to Info.plist):
  // NSCameraUsageDescription, NSPhotoLibraryUsageDescription
`,
  },

  // ── File Browser ────────────────────────────────────
  {
    id: 'file_picker', name: 'File Browser', icon: '📁', category: 'Storage',
    pubPackage: 'file_picker', version: '^6.1.1',
    description: 'Pick files from device storage (PDF, images, docs, any)',
    platforms: ['android', 'ios'],
    dependency: 'file_picker: ^6.1.1',
    widgetType: 'flutter.widgets.native.FilePicker',
    widgetProps: { label: 'File Browser', icon: 'Icons.folder_open' },
    dartSnippet: `
  // ── File Browser ─────────────────────────────────────
  FilePickerResult? _pickedFiles;

  Future<void> pickFiles({ List<String>? allowedExtensions }) async {
    final result = await FilePicker.platform.pickFiles(
      type: allowedExtensions != null ? FileType.custom : FileType.any,
      allowedExtensions: allowedExtensions, // e.g. ['pdf', 'doc', 'xlsx']
      allowMultiple: false,
    );
    if (result != null) {
      _pickedFiles = result;
      final file = result.files.single;
      final path = file.path;           // local file path
      final bytes = file.bytes;         // file bytes (web)
      final name  = file.name;          // filename
      // TODO: handle picked file
    }
  }
`,
  },

  // ── QR Code Reader ──────────────────────────────────
  {
    id: 'qr_reader', name: 'QR Scanner', icon: '▦', category: 'Scanner',
    pubPackage: 'mobile_scanner', version: '^3.5.6',
    description: 'QR code & barcode scanner using device camera',
    platforms: ['android', 'ios'],
    dependency: 'mobile_scanner: ^3.5.6',
    widgetType: 'flutter.widgets.native.QrScanner',
    widgetProps: { label: 'QR Scanner', icon: 'Icons.qr_code_scanner' },
    dartSnippet: `
  // ── QR Code / Barcode Scanner ─────────────────────────
  final MobileScannerController _scannerCtrl = MobileScannerController();
  String? _scannedValue;
  bool _isScanning = false;

  void startScanning() => setState(() => _isScanning = true);
  void stopScanning()  { _scannerCtrl.stop(); setState(() => _isScanning = false); }

  void onBarcodeDetected(BarcodeCapture capture) {
    final barcode = capture.barcodes.firstOrNull;
    if (barcode?.rawValue != null) {
      _scannedValue = barcode!.rawValue!;
      stopScanning();
      // TODO: handle scanned value (URL, text, product code, etc.)
    }
  }

  // In your widget tree, add the scanner view:
  // MobileScanner(controller: _scannerCtrl, onDetect: onBarcodeDetected)
  //
  // Required Android: <uses-permission android:name="android.permission.CAMERA"/>
  // Required iOS: NSCameraUsageDescription in Info.plist
`,
  },

  // ── Audio ────────────────────────────────────────────
  {
    id: 'audio', name: 'Audio', icon: '🔊', category: 'Media',
    pubPackage: 'just_audio', version: '^0.9.36',
    description: 'Audio playback — MP3, AAC, streams, local files',
    platforms: ['android', 'ios'],
    dependency: 'just_audio: ^0.9.36',
    widgetType: 'flutter.widgets.native.AudioPlayer',
    widgetProps: { label: 'Audio Player', icon: 'Icons.headphones' },
    dartSnippet: `
  // ── Audio Player ─────────────────────────────────────
  final AudioPlayer _audioPlayer = AudioPlayer();

  @override
  void dispose() {
    _audioPlayer.dispose();
    super.dispose();
  }

  Future<void> playAudioFromUrl(String url) async {
    await _audioPlayer.setUrl(url);
    await _audioPlayer.play();
  }

  Future<void> playAudioFromAsset(String assetPath) async {
    await _audioPlayer.setAsset(assetPath); // e.g. 'assets/audio/sound.mp3'
    await _audioPlayer.play();
  }

  Future<void> pauseAudio()  async => _audioPlayer.pause();
  Future<void> stopAudio()   async => _audioPlayer.stop();
  Future<void> seekAudio(Duration position) async => _audioPlayer.seek(position);

  // Stream the current playback state
  // _audioPlayer.playingStream → Stream<bool>
  // _audioPlayer.positionStream → Stream<Duration>
  // _audioPlayer.durationStream → Stream<Duration?>
`,
  },

  // ── Video ────────────────────────────────────────────
  {
    id: 'video', name: 'Video Player', icon: '▶', category: 'Media',
    pubPackage: 'video_player', version: '^2.8.2',
    description: 'Play video files from network, assets, or local storage',
    platforms: ['android', 'ios'],
    dependency: 'video_player: ^2.8.2',
    widgetType: 'flutter.widgets.native.VideoPlayer',
    widgetProps: { label: 'Video Player', icon: 'Icons.videocam' },
    dartSnippet: `
  // ── Video Player ─────────────────────────────────────
  late VideoPlayerController _videoCtrl;
  bool _videoInitialized = false;

  Future<void> initVideoFromUrl(String url) async {
    _videoCtrl = VideoPlayerController.networkUrl(Uri.parse(url));
    await _videoCtrl.initialize();
    setState(() => _videoInitialized = true);
    _videoCtrl.play();
  }

  Future<void> initVideoFromAsset(String assetPath) async {
    _videoCtrl = VideoPlayerController.asset(assetPath);
    await _videoCtrl.initialize();
    setState(() => _videoInitialized = true);
  }

  void playVideo()  => _videoCtrl.play();
  void pauseVideo() => _videoCtrl.pause();

  @override
  void dispose() {
    _videoCtrl.dispose();
    super.dispose();
  }

  // In your widget tree:
  // _videoInitialized ? AspectRatio(aspectRatio: _videoCtrl.value.aspectRatio, child: VideoPlayer(_videoCtrl)) : CircularProgressIndicator()
`,
  },

  // ── Biometric Auth ──────────────────────────────────
  {
    id: 'biometric', name: 'Biometric Auth', icon: '👆', category: 'Security',
    pubPackage: 'local_auth', version: '^2.1.8',
    description: 'Fingerprint, Face ID, PIN authentication',
    platforms: ['android', 'ios'],
    dependency: 'local_auth: ^2.1.8',
    widgetType: 'flutter.widgets.native.BiometricAuth',
    widgetProps: { label: 'Biometric Auth', icon: 'Icons.fingerprint' },
    dartSnippet: `
  // ── Biometric Auth ───────────────────────────────────
  final LocalAuthentication _localAuth = LocalAuthentication();

  Future<bool> isBiometricAvailable() async {
    final canCheck = await _localAuth.canCheckBiometrics;
    final isDeviceSupported = await _localAuth.isDeviceSupported();
    return canCheck && isDeviceSupported;
  }

  Future<bool> authenticateWithBiometrics({ String reason = 'Please authenticate' }) async {
    try {
      return await _localAuth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          biometricOnly: false, // true = fingerprint/face only, false = also allows PIN
          stickyAuth: true,
        ),
      );
    } on PlatformException catch (e) {
      // e.code: notAvailable, notEnrolled, lockedOut, permanentlyLockedOut
      return false;
    }
  }

  // Android: add to AndroidManifest.xml:
  // <uses-permission android:name="android.permission.USE_BIOMETRIC"/>
  // iOS: add to Info.plist:
  // NSFaceIDUsageDescription
`,
  },

  // ── Push Notifications ──────────────────────────────
  {
    id: 'push_notifications', name: 'Push Notifications', icon: '🔔', category: 'Connectivity',
    pubPackage: 'firebase_messaging', version: '^14.7.9',
    description: 'Firebase Cloud Messaging — push notifications on Android & iOS',
    platforms: ['android', 'ios'],
    dependency: 'firebase_messaging: ^14.7.9',
    widgetType: 'flutter.widgets.native.PushNotifications',
    widgetProps: { label: 'Push Notifications', icon: 'Icons.notifications' },
    dartSnippet: `
  // ── Push Notifications (FCM) ─────────────────────────
  String? _fcmToken;

  Future<void> initPushNotifications() async {
    // Request permission (iOS)
    final settings = await FirebaseMessaging.instance.requestPermission(
      alert: true, badge: true, sound: true,
    );

    // Get FCM token (send this to your backend to send targeted notifications)
    _fcmToken = await FirebaseMessaging.instance.getToken();
    // TODO: send _fcmToken to your UserService backend

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      final title = message.notification?.title;
      final body  = message.notification?.body;
      final data  = message.data;
      // TODO: show in-app notification or update state
    });

    // Handle notification tap when app is in background
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      // TODO: navigate based on message.data
    });
  }

  // Required setup: add google-services.json (Android) and GoogleService-Info.plist (iOS)
`,
  },

  // ── Location / GPS ──────────────────────────────────
  {
    id: 'location', name: 'Location / GPS', icon: '📍', category: 'Sensors',
    pubPackage: 'geolocator', version: '^11.0.0',
    description: 'Get device GPS location, track position, calculate distance',
    platforms: ['android', 'ios'],
    dependency: 'geolocator: ^11.0.0',
    widgetType: 'flutter.widgets.native.Location',
    widgetProps: { label: 'Location / GPS', icon: 'Icons.location_on' },
    dartSnippet: `
  // ── Location / GPS ───────────────────────────────────
  Position? _currentPosition;

  Future<bool> requestLocationPermission() async {
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.always ||
           permission == LocationPermission.whileInUse;
  }

  Future<void> getCurrentLocation() async {
    final hasPermission = await requestLocationPermission();
    if (!hasPermission) return;

    _currentPosition = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );
    // _currentPosition.latitude, _currentPosition.longitude
    // TODO: use coordinates — show on map, send to backend
  }

  // Track continuous location updates:
  // final positionStream = Geolocator.getPositionStream(locationSettings: LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 10));
  // positionStream.listen((Position position) { ... });

  // Android: add to AndroidManifest.xml:
  // <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
  // iOS: add to Info.plist:
  // NSLocationWhenInUseUsageDescription
`,
  },

  // ── Bluetooth / NFC ─────────────────────────────────
  {
    id: 'bluetooth', name: 'Bluetooth / NFC', icon: '⬡', category: 'Connectivity',
    pubPackage: 'flutter_blue_plus', version: '^1.31.5',
    description: 'BLE device discovery, connect, read/write characteristics',
    platforms: ['android', 'ios'],
    dependency: 'flutter_blue_plus: ^1.31.5',
    widgetType: 'flutter.widgets.native.Bluetooth',
    widgetProps: { label: 'Bluetooth', icon: 'Icons.bluetooth' },
    dartSnippet: `
  // ── Bluetooth (BLE) ──────────────────────────────────
  List<BluetoothDevice> _discoveredDevices = [];
  BluetoothDevice? _connectedDevice;

  Future<void> startBluetoothScan({ Duration timeout = const Duration(seconds: 5) }) async {
    _discoveredDevices.clear();

    await FlutterBluePlus.startScan(timeout: timeout);
    FlutterBluePlus.scanResults.listen((results) {
      for (final r in results) {
        if (!_discoveredDevices.contains(r.device)) {
          _discoveredDevices.add(r.device);
          // TODO: update UI with discovered devices
        }
      }
    });
  }

  Future<void> connectToDevice(BluetoothDevice device) async {
    await device.connect(timeout: const Duration(seconds: 10));
    _connectedDevice = device;
    // Discover services
    final services = await device.discoverServices();
    // TODO: read/write characteristics
  }

  Future<void> disconnectDevice() async {
    await _connectedDevice?.disconnect();
    _connectedDevice = null;
  }

  // Android: add permissions to AndroidManifest.xml (BLUETOOTH, BLUETOOTH_SCAN, etc.)
  // iOS: add NSBluetoothAlwaysUsageDescription to Info.plist
`,
  },

  // ── Share / Deep Links ──────────────────────────────
  {
    id: 'share', name: 'Share / Deep Links', icon: '↗', category: 'Connectivity',
    pubPackage: 'share_plus', version: '^7.2.1',
    description: 'Native share sheet + deep link handling',
    platforms: ['android', 'ios'],
    dependency: 'share_plus: ^7.2.1',
    widgetType: 'flutter.widgets.native.Share',
    widgetProps: { label: 'Share', icon: 'Icons.share' },
    dartSnippet: `
  // ── Share / Deep Links ───────────────────────────────

  // Share text or URL using native share sheet
  Future<void> shareText(String text, { String? subject }) async {
    await Share.share(text, subject: subject);
  }

  // Share a file
  Future<void> shareFile(String filePath, { String? text }) async {
    await Share.shareXFiles(
      [XFile(filePath)],
      text: text,
    );
  }

  // Share multiple files
  Future<void> shareFiles(List<String> filePaths) async {
    await Share.shareXFiles(filePaths.map((p) => XFile(p)).toList());
  }

  // Deep link handling — add to main.dart:
  // final appLinks = AppLinks();
  // appLinks.uriLinkStream.listen((uri) {
  //   // Handle incoming deep link — navigate to correct screen
  // });
`,
  },
]

const PLUGIN_CATEGORIES = [...new Set(NATIVE_PLUGINS.map(p => p.category))]

// ─────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────

interface Props {
  onDragStart: (plugin: NativePlugin) => void
  onDrop:      (plugin: NativePlugin) => void
}

export default function NativePluginPalette({ onDragStart, onDrop }: Props): JSX.Element {
  const [search,   setSearch]   = useState('')
  const [category, setCategory] = useState<string | null>(null)

  const filtered = NATIVE_PLUGINS.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase())
    const matchCat    = !category || p.category === category
    return matchSearch && matchCat
  })

  const grouped = PLUGIN_CATEGORIES.reduce<Record<string, NativePlugin[]>>((acc, cat) => {
    const items = filtered.filter(p => p.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {})

  return (
    <div style={s.palette}>
      {/* Header */}
      <div style={s.header}>
        <span style={{ fontSize:13, color:'#e09b2d' }}>⊛</span>
        <span style={{ fontSize:12, fontWeight:700, color:'#e0d7ff' }}>Native Plugins</span>
        <span style={{ fontSize:9, color:'#555', marginLeft:4 }}>drag to canvas</span>
      </div>

      {/* Search */}
      <div style={s.searchRow}>
        <span style={{ color:'#555', fontSize:11 }}>⌕</span>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search plugins..." style={s.searchInput} />
        {search && <button onClick={() => setSearch('')} style={s.clearBtn}>×</button>}
      </div>

      {/* Category filters */}
      <div style={s.catRow}>
        <button onClick={() => setCategory(null)} style={{
          ...s.catBtn,
          background:  !category ? '#1e1a33' : 'transparent',
          color:       !category ? '#e09b2d' : '#444',
          borderColor: !category ? '#7a5c00' : '#1e1e2e',
        }}>All</button>
        {PLUGIN_CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setCategory(category===cat ? null : cat)} style={{
            ...s.catBtn,
            background:  category===cat ? '#1e1a33' : 'transparent',
            color:       category===cat ? '#e09b2d' : '#444',
            borderColor: category===cat ? '#7a5c00' : '#1e1e2e',
          }}>{cat}</button>
        ))}
      </div>

      {/* Plugin list */}
      <div style={s.list}>
        {Object.entries(grouped).map(([cat, plugins]) => (
          <div key={cat}>
            <div style={s.catLabel}>{cat}</div>
            {plugins.map(plugin => (
              <div key={plugin.id}
                draggable
                onDragStart={() => onDragStart(plugin)}
                style={s.pluginItem}
                title={plugin.description}
              >
                <span style={s.pluginIcon}>{plugin.icon}</span>
                <div style={s.pluginInfo}>
                  <div style={s.pluginName}>{plugin.name}</div>
                  <div style={s.pluginPkg}>{plugin.pubPackage}</div>
                  <div style={s.pluginDesc}>{plugin.description}</div>
                  <div style={s.platformRow}>
                    {plugin.platforms.map(p => (
                      <span key={p} style={s.platformTag}>{p}</span>
                    ))}
                  </div>
                </div>
                <span style={s.dragHandle}>⠿</span>
              </div>
            ))}
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding:16, color:'#444', fontSize:11, textAlign:'center' as const }}>
            No plugins match "{search}"
          </div>
        )}
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  palette:     { display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background:'#0a0a16' },
  header:      { display:'flex', alignItems:'center', gap:6, padding:'8px 10px', borderBottom:'1px solid #1e1e2e' },
  searchRow:   { display:'flex', alignItems:'center', gap:6, padding:'6px 10px', borderBottom:'1px solid #1e1e2e' },
  searchInput: { flex:1, background:'none', border:'none', outline:'none', color:'#ccc', fontSize:11 },
  clearBtn:    { background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:14 },
  catRow:      { display:'flex', flexWrap:'wrap' as const, gap:3, padding:'5px 8px', borderBottom:'1px solid #1e1e2e' },
  catBtn:      { padding:'2px 7px', borderRadius:20, border:'1px solid', fontSize:9, cursor:'pointer', fontFamily:'system-ui,sans-serif' },
  list:        { flex:1, overflowY:'auto' as const },
  catLabel:    { fontSize:9, fontWeight:700, color:'#555', letterSpacing:'0.07em', padding:'8px 10px 3px', textTransform:'uppercase' as const },
  pluginItem:  { display:'flex', alignItems:'flex-start', gap:8, padding:'8px 10px', cursor:'grab', userSelect:'none' as const, borderBottom:'1px solid #0f0f1e' },
  pluginIcon:  { width:28, height:28, borderRadius:6, background:'#1a1500', border:'1px solid #7a5c00', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 },
  pluginInfo:  { flex:1, overflow:'hidden' },
  pluginName:  { fontSize:11, fontWeight:600, color:'#e0d7ff', marginBottom:1 },
  pluginPkg:   { fontSize:9, color:'#7c5cbf', fontFamily:'monospace', marginBottom:2 },
  pluginDesc:  { fontSize:10, color:'#555', lineHeight:1.4, marginBottom:3 },
  platformRow: { display:'flex', gap:4 },
  platformTag: { fontSize:8, padding:'1px 5px', borderRadius:10, background:'#0f0f1e', color:'#666', border:'1px solid #1e1e2e' },
  dragHandle:  { color:'#333', fontSize:11, marginTop:2 },
}
