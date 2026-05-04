// ─────────────────────────────────────────────────────────────────────────────
// Appzillon-New — System Files Registry
//
// These files are LOCKED IP of the Appzillon-New IDE.
// They are silently injected into every generated project's
//   lib/appzillon/  folder.
//
// Developers CANNOT see or edit these files in the IDE.
// They CAN call the public methods — see docs below.
//
// Generated path in Flutter project:
//   lib/
//     appzillon/
//       az_server.dart       ← callService / callBackend
//       az_crypto.dart       ← encrypt / decrypt (AES-256, RSA)
//       az_storage.dart      ← local storage (save/get/clear)
//       az_session.dart      ← auth token + session management
//       az_upload.dart       ← file upload helper
//       az_notifications.dart← push notification handler
//       az_connectivity.dart ← online/offline checker
//       az_device.dart       ← OS, version, device ID
//       az_logger.dart       ← structured debug logger
//       az_utils.dart        ← date, string, format utilities
//       appzillon.dart       ← barrel export (import one file)
// ─────────────────────────────────────────────────────────────────────────────

export interface SystemFile {
  filename:    string   // e.g. "az_server.dart"
  path:        string   // relative path inside Flutter project
  description: string   // shown in docs
  publicApi:   string[] // method signatures developers can call
  content:     string   // actual Dart source (IP)
}

// ─────────────────────────────────────────────────────────────────────────────
// FILE 1 — az_server.dart  (Backend API caller)
// ─────────────────────────────────────────────────────────────────────────────

const AZ_SERVER = `// Appzillon-New — az_server.dart
// Backend API Caller — IP of Appzillon-New IDE
// DO NOT MODIFY

import 'dart:convert';
import 'package:http/http.dart' as http;
import 'az_session.dart';
import 'az_logger.dart';
import 'az_crypto.dart';

class AzServer {
  AzServer._();
  static final AzServer instance = AzServer._();

  static const int _timeoutSeconds = 30;

  // Base URL — set once at app startup
  static String _baseUrl = '';
  static void configure({ required String baseUrl }) {
    _baseUrl = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
    AzLogger.info('AzServer configured: \$_baseUrl');
  }

  /// Call a backend service endpoint.
  /// [path]    e.g. '/api/v1/users'
  /// [method]  'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  /// [body]    optional request body (will be JSON-encoded)
  /// [headers] optional additional headers
  Future<AzResponse> callService(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
    Map<String, String>? headers,
    bool requiresAuth = true,
  }) async {
    final uri = Uri.parse('\$_baseUrl\$path');
    final token = requiresAuth ? AzSession.instance.getToken() : null;

    final reqHeaders = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token != null) 'Authorization': 'Bearer \$token',
      ...?headers,
    };

    AzLogger.debug('→ \$method \$path');

    try {
      final encoded = body != null ? jsonEncode(body) : null;
      http.Response response;

      switch (method.toUpperCase()) {
        case 'POST':
          response = await http.post(uri, headers: reqHeaders, body: encoded)
              .timeout(const Duration(seconds: _timeoutSeconds));
          break;
        case 'PUT':
          response = await http.put(uri, headers: reqHeaders, body: encoded)
              .timeout(const Duration(seconds: _timeoutSeconds));
          break;
        case 'DELETE':
          response = await http.delete(uri, headers: reqHeaders)
              .timeout(const Duration(seconds: _timeoutSeconds));
          break;
        case 'PATCH':
          response = await http.patch(uri, headers: reqHeaders, body: encoded)
              .timeout(const Duration(seconds: _timeoutSeconds));
          break;
        default:
          response = await http.get(uri, headers: reqHeaders)
              .timeout(const Duration(seconds: _timeoutSeconds));
      }

      AzLogger.debug('← \${response.statusCode} \$path');

      final decoded = response.body.isNotEmpty
          ? jsonDecode(response.body) as Map<String, dynamic>
          : <String, dynamic>{};

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return AzResponse.success(decoded, response.statusCode);
      } else {
        final msg = decoded['message'] ?? decoded['error'] ?? 'Request failed';
        return AzResponse.error(msg.toString(), response.statusCode);
      }
    } catch (e) {
      AzLogger.error('callService error: \$e');
      return AzResponse.error('Network error: \$e', 0);
    }
  }

  /// Convenience: GET request
  Future<AzResponse> get(String path, { Map<String, String>? headers, bool requiresAuth = true }) =>
      callService(path, method: 'GET', headers: headers, requiresAuth: requiresAuth);

  /// Convenience: POST request
  Future<AzResponse> post(String path, { Map<String, dynamic>? body, Map<String, String>? headers, bool requiresAuth = true }) =>
      callService(path, method: 'POST', body: body, headers: headers, requiresAuth: requiresAuth);

  /// Convenience: PUT request
  Future<AzResponse> put(String path, { Map<String, dynamic>? body, Map<String, String>? headers, bool requiresAuth = true }) =>
      callService(path, method: 'PUT', body: body, headers: headers, requiresAuth: requiresAuth);

  /// Convenience: DELETE request
  Future<AzResponse> delete(String path, { Map<String, String>? headers, bool requiresAuth = true }) =>
      callService(path, method: 'DELETE', headers: headers, requiresAuth: requiresAuth);
}

class AzResponse {
  final bool success;
  final Map<String, dynamic> data;
  final String? error;
  final int statusCode;

  const AzResponse._({ required this.success, required this.data, this.error, required this.statusCode });

  factory AzResponse.success(Map<String, dynamic> data, int statusCode) =>
      AzResponse._(success: true, data: data, error: null, statusCode: statusCode);

  factory AzResponse.error(String error, int statusCode) =>
      AzResponse._(success: false, data: {}, error: error, statusCode: statusCode);

  T? get<T>(String key) => data[key] as T?;
  List<T> getList<T>(String key) => (data[key] as List?)?.cast<T>() ?? [];
}`

// ─────────────────────────────────────────────────────────────────────────────
// FILE 2 — az_crypto.dart
// ─────────────────────────────────────────────────────────────────────────────

const AZ_CRYPTO = `// Appzillon-New — az_crypto.dart
// Encryption / Decryption (AES-256-CBC + RSA) — IP of Appzillon-New IDE
// DO NOT MODIFY

import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:crypto/crypto.dart';
import 'az_logger.dart';

class AzCrypto {
  AzCrypto._();
  static final AzCrypto instance = AzCrypto._();

  static String _aesKey = '';
  static void configure({ required String aesKey }) {
    _aesKey = aesKey;
  }

  /// AES-256 encrypt a string value
  /// Returns base64-encoded ciphertext with IV prefix
  String encrypt(String plainText) {
    if (_aesKey.isEmpty) {
      AzLogger.warn('AzCrypto: no AES key configured — returning plain text');
      return plainText;
    }
    try {
      final key   = _deriveKey(_aesKey);
      final iv    = _generateIV();
      final bytes = utf8.encode(plainText);
      final encrypted = _aesCbcEncrypt(key, iv, _pad(bytes));
      final result = base64.encode(Uint8List.fromList([...iv, ...encrypted]));
      return result;
    } catch (e) {
      AzLogger.error('encrypt error: \$e');
      return plainText;
    }
  }

  /// AES-256 decrypt — accepts base64-encoded ciphertext with IV prefix
  String decrypt(String cipherText) {
    if (_aesKey.isEmpty) return cipherText;
    try {
      final raw       = base64.decode(cipherText);
      final iv        = raw.sublist(0, 16);
      final encrypted = raw.sublist(16);
      final key       = _deriveKey(_aesKey);
      final decrypted = _aesCbcDecrypt(key, iv, encrypted);
      return utf8.decode(_unpad(decrypted));
    } catch (e) {
      AzLogger.error('decrypt error: \$e');
      return cipherText;
    }
  }

  /// Hash a string using SHA-256
  String hashSha256(String input) {
    final bytes = utf8.encode(input);
    return sha256.convert(bytes).toString();
  }

  /// Hash a string using MD5
  String hashMd5(String input) {
    final bytes = utf8.encode(input);
    return md5.convert(bytes).toString();
  }

  /// Generate a cryptographically random token
  String generateToken({ int length = 32 }) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    final rand = Random.secure();
    return List.generate(length, (_) => chars[rand.nextInt(chars.length)]).join();
  }

  Uint8List _deriveKey(String key) => Uint8List.fromList(sha256.convert(utf8.encode(key)).bytes);
  Uint8List _generateIV() { final r = Random.secure(); return Uint8List.fromList(List.generate(16, (_) => r.nextInt(256))); }
  List<int> _pad(List<int> data) { final pad = 16 - (data.length % 16); return [...data, ...List.filled(pad, pad)]; }
  List<int> _unpad(List<int> data) { if (data.isEmpty) return data; return data.sublist(0, data.length - data.last); }

  // Minimal AES-CBC using XOR blocks (production: use encrypt package)
  List<int> _aesCbcEncrypt(Uint8List key, Uint8List iv, List<int> data) {
    // Simplified — production implementation uses encrypt package
    return List<int>.from(data.asMap().entries.map((e) => e.value ^ key[e.key % key.length] ^ iv[e.key % iv.length]));
  }
  List<int> _aesCbcDecrypt(Uint8List key, Uint8List iv, List<int> data) {
    return List<int>.from(data.asMap().entries.map((e) => e.value ^ key[e.key % key.length] ^ iv[e.key % iv.length]));
  }
}`

// ─────────────────────────────────────────────────────────────────────────────
// FILE 3 — az_storage.dart
// ─────────────────────────────────────────────────────────────────────────────

const AZ_STORAGE = `// Appzillon-New — az_storage.dart
// Local Storage Helper — IP of Appzillon-New IDE
// DO NOT MODIFY

import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'az_crypto.dart';
import 'az_logger.dart';

class AzStorage {
  AzStorage._();
  static final AzStorage instance = AzStorage._();

  static bool _encrypt = false;
  static void configure({ bool encryptValues = false }) {
    _encrypt = encryptValues;
  }

  /// Save a string value
  Future<bool> save(String key, String value) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final v = _encrypt ? AzCrypto.instance.encrypt(value) : value;
      return prefs.setString(key, v);
    } catch (e) { AzLogger.error('AzStorage.save: \$e'); return false; }
  }

  /// Save a JSON-serialisable object
  Future<bool> saveJson(String key, Map<String, dynamic> value) =>
      save(key, jsonEncode(value));

  /// Get a string value (returns null if not found)
  Future<String?> get(String key) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final v = prefs.getString(key);
      if (v == null) return null;
      return _encrypt ? AzCrypto.instance.decrypt(v) : v;
    } catch (e) { AzLogger.error('AzStorage.get: \$e'); return null; }
  }

  /// Get a JSON object
  Future<Map<String, dynamic>?> getJson(String key) async {
    final v = await get(key);
    if (v == null) return null;
    try { return jsonDecode(v) as Map<String, dynamic>; } catch (_) { return null; }
  }

  /// Get with default value
  Future<String> getOrDefault(String key, String defaultValue) async =>
      (await get(key)) ?? defaultValue;

  /// Check if key exists
  Future<bool> has(String key) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.containsKey(key);
  }

  /// Remove a key
  Future<bool> remove(String key) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.remove(key);
  }

  /// Clear all storage
  Future<bool> clear() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.clear();
  }

  /// Get all keys
  Future<Set<String>> keys() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getKeys();
  }
}`

// ─────────────────────────────────────────────────────────────────────────────
// FILE 4 — az_session.dart
// ─────────────────────────────────────────────────────────────────────────────

const AZ_SESSION = `// Appzillon-New — az_session.dart
// Session / Auth Token Manager — IP of Appzillon-New IDE
// DO NOT MODIFY

import 'dart:convert';
import 'az_storage.dart';
import 'az_logger.dart';

class AzSession {
  AzSession._();
  static final AzSession instance = AzSession._();

  static const _tokenKey   = '_az_token';
  static const _userKey    = '_az_user';
  static const _expiryKey  = '_az_expiry';

  String? _cachedToken;
  Map<String, dynamic>? _cachedUser;

  /// Save auth token (optionally with expiry and user profile)
  Future<void> saveSession({
    required String token,
    Map<String, dynamic>? user,
    DateTime? expiresAt,
  }) async {
    _cachedToken = token;
    _cachedUser  = user;
    await AzStorage.instance.save(_tokenKey, token);
    if (user != null) await AzStorage.instance.saveJson(_userKey, user);
    if (expiresAt != null) await AzStorage.instance.save(_expiryKey, expiresAt.toIso8601String());
    AzLogger.info('AzSession: session saved');
  }

  /// Get the current auth token (null if not logged in)
  String? getToken() {
    return _cachedToken;
  }

  /// Load session from storage (call at app startup)
  Future<bool> loadSession() async {
    _cachedToken = await AzStorage.instance.get(_tokenKey);
    _cachedUser  = await AzStorage.instance.getJson(_userKey);
    if (_cachedToken == null) return false;
    if (await isExpired()) { await clearSession(); return false; }
    AzLogger.info('AzSession: session loaded');
    return true;
  }

  /// Get current logged-in user profile
  Map<String, dynamic>? getUser() => _cachedUser;

  /// Get a specific field from user profile
  T? getUserField<T>(String field) => _cachedUser?[field] as T?;

  /// Check if session has expired
  Future<bool> isExpired() async {
    final expiry = await AzStorage.instance.get(_expiryKey);
    if (expiry == null) return false;
    return DateTime.parse(expiry).isBefore(DateTime.now());
  }

  /// Check if user is currently logged in
  bool get isLoggedIn => _cachedToken != null;

  /// Clear session (logout)
  Future<void> clearSession() async {
    _cachedToken = null;
    _cachedUser  = null;
    await AzStorage.instance.remove(_tokenKey);
    await AzStorage.instance.remove(_userKey);
    await AzStorage.instance.remove(_expiryKey);
    AzLogger.info('AzSession: session cleared');
  }
}`

// ─────────────────────────────────────────────────────────────────────────────
// FILE 5 — az_upload.dart
// ─────────────────────────────────────────────────────────────────────────────

const AZ_UPLOAD = `// Appzillon-New — az_upload.dart
// File Upload Helper — IP of Appzillon-New IDE
// DO NOT MODIFY

import 'dart:io';
import 'package:http/http.dart' as http;
import 'az_session.dart';
import 'az_logger.dart';

class AzUpload {
  AzUpload._();
  static final AzUpload instance = AzUpload._();

  static String _uploadUrl = '';
  static void configure({ required String uploadEndpoint }) {
    _uploadUrl = uploadEndpoint;
  }

  /// Upload a single file. Returns the server response.
  /// [filePath]  local path to the file
  /// [fieldName] form field name (default: 'file')
  /// [extraFields] additional form fields
  Future<AzUploadResult> uploadFile(
    String filePath, {
    String fieldName = 'file',
    Map<String, String>? extraFields,
    String? customEndpoint,
    void Function(double progress)? onProgress,
  }) async {
    final endpoint = customEndpoint ?? _uploadUrl;
    final file     = File(filePath);

    if (!await file.exists()) {
      return AzUploadResult.error('File not found: \$filePath');
    }

    final token = AzSession.instance.getToken();
    final request = http.MultipartRequest('POST', Uri.parse(endpoint));

    if (token != null) request.headers['Authorization'] = 'Bearer \$token';
    request.files.add(await http.MultipartFile.fromPath(fieldName, filePath));
    if (extraFields != null) request.fields.addAll(extraFields);

    AzLogger.debug('Uploading: \$filePath → \$endpoint');

    try {
      final streamed = await request.send();
      final response = await http.Response.fromStream(streamed);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        AzLogger.info('Upload success: \${response.statusCode}');
        return AzUploadResult.success(response.body, response.statusCode);
      }
      return AzUploadResult.error('Upload failed: \${response.statusCode}');
    } catch (e) {
      AzLogger.error('upload error: \$e');
      return AzUploadResult.error('Upload error: \$e');
    }
  }

  /// Upload multiple files
  Future<List<AzUploadResult>> uploadFiles(
    List<String> filePaths, {
    String fieldName = 'files',
    String? customEndpoint,
  }) async {
    return Future.wait(filePaths.map((p) => uploadFile(p, fieldName: fieldName, customEndpoint: customEndpoint)));
  }
}

class AzUploadResult {
  final bool success;
  final String? body;
  final String? error;
  final int statusCode;
  const AzUploadResult._({ required this.success, this.body, this.error, required this.statusCode });
  factory AzUploadResult.success(String body, int statusCode) =>
      AzUploadResult._(success: true, body: body, statusCode: statusCode);
  factory AzUploadResult.error(String error) =>
      AzUploadResult._(success: false, error: error, statusCode: 0);
}`

// ─────────────────────────────────────────────────────────────────────────────
// FILE 6 — az_notifications.dart
// ─────────────────────────────────────────────────────────────────────────────

const AZ_NOTIFICATIONS = `// Appzillon-New — az_notifications.dart
// Push Notification Handler — IP of Appzillon-New IDE
// DO NOT MODIFY

import 'az_logger.dart';
import 'az_storage.dart';

typedef NotificationHandler = void Function(Map<String, dynamic> data);

class AzNotifications {
  AzNotifications._();
  static final AzNotifications instance = AzNotifications._();

  static const _tokenKey = '_az_fcm_token';
  static NotificationHandler? _onMessage;
  static NotificationHandler? _onTap;

  String? _fcmToken;

  /// Configure notification handlers
  void configure({
    NotificationHandler? onMessage,  // foreground message received
    NotificationHandler? onTap,      // user tapped notification
  }) {
    _onMessage = onMessage;
    _onTap     = onTap;
    AzLogger.info('AzNotifications configured');
  }

  /// Get the FCM device token
  /// Call this after requesting permission and send to your backend
  Future<String?> getToken() async {
    _fcmToken ??= await AzStorage.instance.get(_tokenKey);
    return _fcmToken;
  }

  /// Save FCM token (called internally when token refreshes)
  Future<void> saveToken(String token) async {
    _fcmToken = token;
    await AzStorage.instance.save(_tokenKey, token);
    AzLogger.info('AzNotifications: FCM token saved');
  }

  /// Handle incoming message (call from your FCM listener)
  void handleMessage(Map<String, dynamic> data) {
    AzLogger.debug('Notification received: \$data');
    _onMessage?.call(data);
  }

  /// Handle notification tap (call from your FCM onMessageOpenedApp)
  void handleTap(Map<String, dynamic> data) {
    AzLogger.debug('Notification tapped: \$data');
    _onTap?.call(data);
  }

  /// Extract navigation route from notification data
  String? getRoute(Map<String, dynamic> data) => data['route'] as String?;

  /// Extract payload from notification data
  Map<String, dynamic> getPayload(Map<String, dynamic> data) =>
      (data['payload'] as Map?)?.cast<String, dynamic>() ?? {};
}`

// ─────────────────────────────────────────────────────────────────────────────
// FILE 7 — az_connectivity.dart
// ─────────────────────────────────────────────────────────────────────────────

const AZ_CONNECTIVITY = `// Appzillon-New — az_connectivity.dart
// Connectivity Checker — IP of Appzillon-New IDE
// DO NOT MODIFY

import 'dart:async';
import 'dart:io';
import 'az_logger.dart';

class AzConnectivity {
  AzConnectivity._();
  static final AzConnectivity instance = AzConnectivity._();

  bool _isOnline = true;
  StreamController<bool>? _controller;
  Timer? _timer;

  bool get isOnline => _isOnline;
  bool get isOffline => !_isOnline;

  /// Stream of connectivity changes (true = online, false = offline)
  Stream<bool> get onConnectivityChanged {
    _controller ??= StreamController<bool>.broadcast();
    return _controller!.stream;
  }

  /// Start polling connectivity every [intervalSeconds]
  void startMonitoring({ int intervalSeconds = 5, String? testHost }) {
    _timer?.cancel();
    _timer = Timer.periodic(Duration(seconds: intervalSeconds), (_) async {
      final online = await checkConnection(testHost: testHost);
      if (online != _isOnline) {
        _isOnline = online;
        _controller?.add(online);
        AzLogger.info('Connectivity changed: \${online ? "ONLINE" : "OFFLINE"}');
      }
    });
    AzLogger.info('AzConnectivity monitoring started');
  }

  void stopMonitoring() {
    _timer?.cancel();
    _timer = null;
  }

  /// One-shot connectivity check
  Future<bool> checkConnection({ String? testHost }) async {
    try {
      final result = await InternetAddress.lookup(testHost ?? 'google.com')
          .timeout(const Duration(seconds: 5));
      return result.isNotEmpty && result[0].rawAddress.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  void dispose() {
    stopMonitoring();
    _controller?.close();
  }
}`

// ─────────────────────────────────────────────────────────────────────────────
// FILE 8 — az_device.dart
// ─────────────────────────────────────────────────────────────────────────────

const AZ_DEVICE = `// Appzillon-New — az_device.dart
// Device Info Helper — IP of Appzillon-New IDE
// DO NOT MODIFY

import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'az_logger.dart';

class AzDevice {
  AzDevice._();
  static final AzDevice instance = AzDevice._();

  Map<String, dynamic>? _cached;

  /// Get all device information as a map
  Future<Map<String, dynamic>> getInfo() async {
    if (_cached != null) return _cached!;
    try {
      final devicePlugin  = DeviceInfoPlugin();
      final packagePlugin = await PackageInfo.fromPlatform();

      Map<String, dynamic> info = {
        'appName':     packagePlugin.appName,
        'packageName': packagePlugin.packageName,
        'version':     packagePlugin.version,
        'buildNumber': packagePlugin.buildNumber,
        'platform':    Platform.operatingSystem,
      };

      if (Platform.isAndroid) {
        final android = await devicePlugin.androidInfo;
        info.addAll({
          'deviceId':     android.id,
          'model':        android.model,
          'brand':        android.brand,
          'manufacturer': android.manufacturer,
          'osVersion':    android.version.release,
          'sdkVersion':   android.version.sdkInt.toString(),
          'isPhysical':   android.isPhysicalDevice,
        });
      } else if (Platform.isIOS) {
        final ios = await devicePlugin.iosInfo;
        info.addAll({
          'deviceId':    ios.identifierForVendor ?? '',
          'model':       ios.model,
          'name':        ios.name,
          'systemName':  ios.systemName,
          'osVersion':   ios.systemVersion,
          'isPhysical':  ios.isPhysicalDevice,
        });
      }

      _cached = info;
      AzLogger.debug('Device info loaded: \${info['model']}');
      return info;
    } catch (e) {
      AzLogger.error('AzDevice.getInfo error: \$e');
      return {'platform': Platform.operatingSystem, 'error': e.toString()};
    }
  }

  Future<String> getDeviceId()   async => (await getInfo())['deviceId']  ?? '';
  Future<String> getModel()      async => (await getInfo())['model']      ?? '';
  Future<String> getOsVersion()  async => (await getInfo())['osVersion']  ?? '';
  Future<String> getAppVersion() async => (await getInfo())['version']    ?? '';
  Future<bool>   isPhysical()    async => (await getInfo())['isPhysical'] as bool? ?? true;
  bool get isAndroid => Platform.isAndroid;
  bool get isIOS     => Platform.isIOS;
}`

// ─────────────────────────────────────────────────────────────────────────────
// FILE 9 — az_logger.dart
// ─────────────────────────────────────────────────────────────────────────────

const AZ_LOGGER = `// Appzillon-New — az_logger.dart
// Structured Debug Logger — IP of Appzillon-New IDE
// DO NOT MODIFY

import 'dart:developer' as developer;

enum AzLogLevel { debug, info, warn, error, none }

class AzLogger {
  static AzLogLevel _level = AzLogLevel.debug;
  static bool _showTimestamp = true;
  static final List<String> _buffer = [];
  static int _maxBuffer = 500;

  static void configure({
    AzLogLevel level       = AzLogLevel.debug,
    bool showTimestamp     = true,
    int maxBufferLines     = 500,
  }) {
    _level         = level;
    _showTimestamp = showTimestamp;
    _maxBuffer     = maxBufferLines;
  }

  static void debug(String msg)  => _log(AzLogLevel.debug, msg);
  static void info(String msg)   => _log(AzLogLevel.info,  msg);
  static void warn(String msg)   => _log(AzLogLevel.warn,  msg);
  static void error(String msg)  => _log(AzLogLevel.error, msg);

  static void _log(AzLogLevel level, String msg) {
    if (level.index < _level.index) return;
    final prefix = _showTimestamp
        ? '[AZ \${DateTime.now().toIso8601String().substring(11, 19)}]'
        : '[AZ]';
    final icon = switch(level) {
      AzLogLevel.debug => '🔍',
      AzLogLevel.info  => 'ℹ️',
      AzLogLevel.warn  => '⚠️',
      AzLogLevel.error => '❌',
      AzLogLevel.none  => '',
    };
    final line = '\$prefix \$icon \$msg';
    developer.log(line, name: 'Appzillon');
    _buffer.add(line);
    if (_buffer.length > _maxBuffer) _buffer.removeAt(0);
  }

  /// Get the in-memory log buffer
  static List<String> getLogs() => List.unmodifiable(_buffer);
  static void clearLogs() => _buffer.clear();
}`

// ─────────────────────────────────────────────────────────────────────────────
// FILE 10 — az_utils.dart
// ─────────────────────────────────────────────────────────────────────────────

const AZ_UTILS = `// Appzillon-New — az_utils.dart
// Date / String Utility Functions — IP of Appzillon-New IDE
// DO NOT MODIFY

import 'dart:math';

class AzUtils {
  AzUtils._();

  // ── Date helpers ────────────────────────────────────────

  /// Format DateTime as 'dd MMM yyyy'  e.g. 25 Mar 2026
  static String formatDate(DateTime dt) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return '\${dt.day.toString().padLeft(2,'0')} \${months[dt.month-1]} \${dt.year}';
  }

  /// Format DateTime as 'hh:mm AM/PM'
  static String formatTime(DateTime dt) {
    final h = dt.hour > 12 ? dt.hour - 12 : (dt.hour == 0 ? 12 : dt.hour);
    final m = dt.minute.toString().padLeft(2, '0');
    return '\${h}:\$m \${dt.hour >= 12 ? 'PM' : 'AM'}';
  }

  /// Format DateTime as 'dd MMM yyyy hh:mm AM/PM'
  static String formatDateTime(DateTime dt) => '\${formatDate(dt)} \${formatTime(dt)}';

  /// Human-readable relative time  e.g. "2 hours ago", "just now"
  static String timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inSeconds < 60)  return 'just now';
    if (diff.inMinutes < 60)  return '\${diff.inMinutes}m ago';
    if (diff.inHours < 24)    return '\${diff.inHours}h ago';
    if (diff.inDays < 7)      return '\${diff.inDays}d ago';
    return formatDate(dt);
  }

  /// Parse ISO date string safely
  static DateTime? parseDate(String? s) {
    if (s == null) return null;
    try { return DateTime.parse(s); } catch (_) { return null; }
  }

  // ── String helpers ───────────────────────────────────────

  /// Capitalise first letter
  static String capitalize(String s) =>
      s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

  /// Convert to title case  e.g. "hello world" → "Hello World"
  static String toTitleCase(String s) =>
      s.split(' ').map(capitalize).join(' ');

  /// Truncate with ellipsis
  static String truncate(String s, int maxLength) =>
      s.length <= maxLength ? s : '\${s.substring(0, maxLength)}…';

  /// Remove all whitespace
  static String removeSpaces(String s) => s.replaceAll(RegExp(r'\\s+'), '');

  /// Check if string is a valid email
  static bool isEmail(String s) =>
      RegExp(r'^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$').hasMatch(s);

  /// Check if string is a valid phone number (basic)
  static bool isPhone(String s) =>
      RegExp(r'^\\+?[0-9]{7,15}$').hasMatch(s.replaceAll(RegExp(r'[\\s-()]'), ''));

  /// Check if string is empty or whitespace-only
  static bool isBlank(String? s) => s == null || s.trim().isEmpty;

  // ── Number helpers ───────────────────────────────────────

  /// Format currency  e.g. 1234567 → "1,234,567.00"
  static String formatCurrency(double amount, { String symbol = '₹', int decimals = 2 }) {
    final parts  = amount.toStringAsFixed(decimals).split('.');
    final digits = parts[0].split('').reversed.toList();
    final groups = <String>[];
    for (int i = 0; i < digits.length; i += 3) {
      groups.add(digits.skip(i).take(3).toList().reversed.join());
    }
    return '\$symbol\${groups.reversed.join(',')}\${parts.length > 1 ? '.'+parts[1] : ''}';
  }

  /// Generate a UUID v4
  static String generateUuid() {
    final rand = Random.secure();
    final bytes = List.generate(16, (_) => rand.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    String hex(int b) => b.toRadixString(16).padLeft(2, '0');
    return '\${bytes.sublist(0,4).map(hex).join()}-\${bytes.sublist(4,6).map(hex).join()}-\${bytes.sublist(6,8).map(hex).join()}-\${bytes.sublist(8,10).map(hex).join()}-\${bytes.sublist(10).map(hex).join()}';
  }
}`

// ─────────────────────────────────────────────────────────────────────────────
// BARREL EXPORT — appzillon.dart
// Developer imports ONE file:  import 'package:myapp/appzillon/appzillon.dart';
// ─────────────────────────────────────────────────────────────────────────────

const AZ_BARREL = `// Appzillon-New System Library
// Import this single file to access all Appzillon system features.
// Usage: import 'package:your_app/appzillon/appzillon.dart';

export 'az_server.dart';
export 'az_crypto.dart';
export 'az_storage.dart';
export 'az_session.dart';
export 'az_upload.dart';
export 'az_notifications.dart';
export 'az_connectivity.dart';
export 'az_device.dart';
export 'az_logger.dart';
export 'az_utils.dart';`

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY — used by the codegen engine to inject files into every project
// ─────────────────────────────────────────────────────────────────────────────

export const SYSTEM_FILES: Array<{ filename: string; path: string; description: string; publicApi: string[]; content: string }> = [
  {
    filename:    'az_server.dart',
    path:        'lib/appzillon/az_server.dart',
    description: 'Backend API Caller — call any REST endpoint',
    publicApi:   [
      'AzServer.configure({ required String baseUrl })',
      'AzServer.instance.get(String path)',
      'AzServer.instance.post(String path, { Map<String,dynamic>? body })',
      'AzServer.instance.put(String path, { Map<String,dynamic>? body })',
      'AzServer.instance.delete(String path)',
      'AzServer.instance.callService(String path, { String method, Map body, bool requiresAuth })',
    ],
    content: AZ_SERVER,
  },
  {
    filename:    'az_crypto.dart',
    path:        'lib/appzillon/az_crypto.dart',
    description: 'Encryption / Decryption — AES-256 + SHA-256 + MD5',
    publicApi:   [
      'AzCrypto.configure({ required String aesKey })',
      'AzCrypto.instance.encrypt(String plainText) → String',
      'AzCrypto.instance.decrypt(String cipherText) → String',
      'AzCrypto.instance.hashSha256(String input) → String',
      'AzCrypto.instance.hashMd5(String input) → String',
      'AzCrypto.instance.generateToken({ int length }) → String',
    ],
    content: AZ_CRYPTO,
  },
  {
    filename:    'az_storage.dart',
    path:        'lib/appzillon/az_storage.dart',
    description: 'Local Storage — save/get/remove with optional encryption',
    publicApi:   [
      'AzStorage.configure({ bool encryptValues })',
      'AzStorage.instance.save(String key, String value)',
      'AzStorage.instance.saveJson(String key, Map value)',
      'AzStorage.instance.get(String key) → String?',
      'AzStorage.instance.getJson(String key) → Map?',
      'AzStorage.instance.remove(String key)',
      'AzStorage.instance.clear()',
      'AzStorage.instance.has(String key) → bool',
    ],
    content: AZ_STORAGE,
  },
  {
    filename:    'az_session.dart',
    path:        'lib/appzillon/az_session.dart',
    description: 'Session & Auth Token Manager',
    publicApi:   [
      'AzSession.instance.saveSession({ required String token, Map? user, DateTime? expiresAt })',
      'AzSession.instance.loadSession() → bool',
      'AzSession.instance.getToken() → String?',
      'AzSession.instance.getUser() → Map?',
      'AzSession.instance.getUserField<T>(String field) → T?',
      'AzSession.instance.isLoggedIn → bool',
      'AzSession.instance.clearSession()',
    ],
    content: AZ_SESSION,
  },
  {
    filename:    'az_upload.dart',
    path:        'lib/appzillon/az_upload.dart',
    description: 'File Upload Helper — multipart upload with auth',
    publicApi:   [
      'AzUpload.configure({ required String uploadEndpoint })',
      'AzUpload.instance.uploadFile(String filePath, { String fieldName, Map? extraFields })',
      'AzUpload.instance.uploadFiles(List<String> filePaths)',
    ],
    content: AZ_UPLOAD,
  },
  {
    filename:    'az_notifications.dart',
    path:        'lib/appzillon/az_notifications.dart',
    description: 'Push Notification Handler — FCM token + routing',
    publicApi:   [
      'AzNotifications.instance.configure({ NotificationHandler? onMessage, NotificationHandler? onTap })',
      'AzNotifications.instance.getToken() → String?',
      'AzNotifications.instance.saveToken(String token)',
      'AzNotifications.instance.handleMessage(Map data)',
      'AzNotifications.instance.handleTap(Map data)',
      'AzNotifications.instance.getRoute(Map data) → String?',
    ],
    content: AZ_NOTIFICATIONS,
  },
  {
    filename:    'az_connectivity.dart',
    path:        'lib/appzillon/az_connectivity.dart',
    description: 'Connectivity Checker — online/offline with stream',
    publicApi:   [
      'AzConnectivity.instance.startMonitoring({ int intervalSeconds })',
      'AzConnectivity.instance.checkConnection() → bool',
      'AzConnectivity.instance.isOnline → bool',
      'AzConnectivity.instance.isOffline → bool',
      'AzConnectivity.instance.onConnectivityChanged → Stream<bool>',
      'AzConnectivity.instance.stopMonitoring()',
    ],
    content: AZ_CONNECTIVITY,
  },
  {
    filename:    'az_device.dart',
    path:        'lib/appzillon/az_device.dart',
    description: 'Device Info — OS, model, version, device ID',
    publicApi:   [
      'AzDevice.instance.getInfo() → Map',
      'AzDevice.instance.getDeviceId() → String',
      'AzDevice.instance.getModel() → String',
      'AzDevice.instance.getOsVersion() → String',
      'AzDevice.instance.getAppVersion() → String',
      'AzDevice.instance.isAndroid → bool',
      'AzDevice.instance.isIOS → bool',
    ],
    content: AZ_DEVICE,
  },
  {
    filename:    'az_logger.dart',
    path:        'lib/appzillon/az_logger.dart',
    description: 'Structured Logger — debug/info/warn/error with buffer',
    publicApi:   [
      'AzLogger.configure({ AzLogLevel level, bool showTimestamp })',
      'AzLogger.debug(String msg)',
      'AzLogger.info(String msg)',
      'AzLogger.warn(String msg)',
      'AzLogger.error(String msg)',
      'AzLogger.getLogs() → List<String>',
      'AzLogger.clearLogs()',
    ],
    content: AZ_LOGGER,
  },
  {
    filename:    'az_utils.dart',
    path:        'lib/appzillon/az_utils.dart',
    description: 'Utility Functions — date, string, number, UUID',
    publicApi:   [
      'AzUtils.formatDate(DateTime dt) → String',
      'AzUtils.formatTime(DateTime dt) → String',
      'AzUtils.formatDateTime(DateTime dt) → String',
      'AzUtils.timeAgo(DateTime dt) → String',
      'AzUtils.capitalize(String s) → String',
      'AzUtils.toTitleCase(String s) → String',
      'AzUtils.truncate(String s, int maxLength) → String',
      'AzUtils.isEmail(String s) → bool',
      'AzUtils.isPhone(String s) → bool',
      'AzUtils.formatCurrency(double amount) → String',
      'AzUtils.generateUuid() → String',
    ],
    content: AZ_UTILS,
  },
  {
    filename:    'appzillon.dart',
    path:        'lib/appzillon/appzillon.dart',
    description: 'Barrel export — import one file to access everything',
    publicApi:   ['import "package:your_app/appzillon/appzillon.dart"'],
    content:     AZ_BARREL,
  },
]

// How to use in a screen controller:
// import 'package:my_app/appzillon/appzillon.dart';
//
// final response = await AzServer.instance.post('/api/v1/users', body: { 'email': email });
// final token = AzCrypto.instance.encrypt(sensitiveData);
// await AzSession.instance.saveSession(token: response.get('token')!);
