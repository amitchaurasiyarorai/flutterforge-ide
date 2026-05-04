package com.flutterforge.codegen.dart;

import com.flutterforge.model.GenerationResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.*;

/**
 * Appzillon-New — System Files Injector
 *
 * Silently injects all 11 locked system files into every generated
 * Flutter project under lib/appzillon/.
 *
 * These files are IP of Appzillon-New IDE and are NOT editable.
 * Developers reference them via:
 *   import 'package:your_app/appzillon/appzillon.dart';
 *
 * pubspec.yaml dependencies auto-added:
 *   http: ^1.2.0
 *   shared_preferences: ^2.2.2
 *   crypto: ^3.0.3
 *   device_info_plus: ^9.1.2
 *   package_info_plus: ^5.0.1
 */
@Slf4j
@Component
public class AppzillonSystemCodegen {

    public void injectSystemFiles(Path outputDir, String packageName,
                                  GenerationResult result) throws IOException {
        log.info("Injecting Appzillon-New system files into {}", outputDir);

        // outputDir is already lib/appzillon — do NOT resolve again
        Path azDir = outputDir;
        Files.createDirectories(azDir);

        write(azDir.resolve("az_server.dart"),        buildServer(packageName),        result);
        write(azDir.resolve("az_crypto.dart"),        buildCrypto(),                   result);
        write(azDir.resolve("az_storage.dart"),       buildStorage(),                  result);
        write(azDir.resolve("az_session.dart"),       buildSession(),                  result);
        write(azDir.resolve("az_upload.dart"),        buildUpload(),                   result);
        write(azDir.resolve("az_notifications.dart"), buildNotifications(),            result);
        write(azDir.resolve("az_connectivity.dart"),  buildConnectivity(),             result);
        write(azDir.resolve("az_device.dart"),        buildDevice(),                   result);
        write(azDir.resolve("az_logger.dart"),        buildLogger(),                   result);
        write(azDir.resolve("az_utils.dart"),         buildUtils(),                    result);
        write(azDir.resolve("az_painter.dart"),       buildPainter(),                  result);
        write(azDir.resolve("az_biometric.dart"),     buildBiometric(),                result);
        write(azDir.resolve("appzillon.dart"),        buildBarrel(),                   result);

        log.info("Appzillon-New system files injected: 13 files");
    }

    /**
     * Returns the pubspec.yaml dependencies block to append.
     */
    public String getRequiredDependencies() {
        return """
               # Appzillon-New system dependencies (auto-injected)
               http: ^1.2.0
               shared_preferences: ^2.2.2
               crypto: ^3.0.3
               device_info_plus: ^9.1.2
               package_info_plus: ^5.0.1
               local_auth: ^2.1.8
               """;
    }

    // ─────────────────────────────────────────────────────────
    // FILE GENERATORS
    // ─────────────────────────────────────────────────────────

    private String buildServer(String packageName) {
        return """
// Appzillon-New — az_server.dart
// Backend API Caller — Locked System File
// DO NOT MODIFY — IP of Appzillon-New IDE

import 'dart:convert';
import 'package:http/http.dart' as http;
import 'az_session.dart';
import 'az_logger.dart';

class AzServer {
  AzServer._();
  static final AzServer instance = AzServer._();
  static const int _timeoutSeconds = 30;
  static String _baseUrl = '';

  static void configure({ required String baseUrl }) {
    _baseUrl = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
    AzLogger.info('AzServer configured: $_baseUrl');
  }

  Future<AzResponse> callService(String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
    Map<String, String>? headers,
    bool requiresAuth = true,
  }) async {
    final uri   = Uri.parse('$_baseUrl$path');
    final token = requiresAuth ? AzSession.instance.getToken() : null;
    final reqHeaders = <String, String>{
      'Content-Type': 'application/json',
      'Accept':       'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
      ...?headers,
    };
    AzLogger.debug('→ $method $path');
    try {
      final encoded = body != null ? jsonEncode(body) : null;
      http.Response response;
      switch (method.toUpperCase()) {
        case 'POST':   response = await http.post(uri,   headers: reqHeaders, body: encoded).timeout(const Duration(seconds: _timeoutSeconds)); break;
        case 'PUT':    response = await http.put(uri,    headers: reqHeaders, body: encoded).timeout(const Duration(seconds: _timeoutSeconds)); break;
        case 'DELETE': response = await http.delete(uri, headers: reqHeaders)               .timeout(const Duration(seconds: _timeoutSeconds)); break;
        case 'PATCH':  response = await http.patch(uri,  headers: reqHeaders, body: encoded).timeout(const Duration(seconds: _timeoutSeconds)); break;
        default:       response = await http.get(uri,    headers: reqHeaders)               .timeout(const Duration(seconds: _timeoutSeconds));
      }
      AzLogger.debug('← ${response.statusCode} $path');
      final decoded = response.body.isNotEmpty ? jsonDecode(response.body) as Map<String, dynamic> : <String, dynamic>{};
      return response.statusCode >= 200 && response.statusCode < 300
          ? AzResponse.success(decoded, response.statusCode)
          : AzResponse.error(decoded['message']?.toString() ?? 'Request failed', response.statusCode);
    } catch (e) {
      AzLogger.error('callService error: $e');
      return AzResponse.error('Network error: $e', 0);
    }
  }

  Future<AzResponse> get(String path, { Map<String, String>? headers, bool requiresAuth = true }) =>
      callService(path, method: 'GET', headers: headers, requiresAuth: requiresAuth);
  Future<AzResponse> post(String path, { Map<String, dynamic>? body, Map<String, String>? headers, bool requiresAuth = true }) =>
      callService(path, method: 'POST', body: body, headers: headers, requiresAuth: requiresAuth);
  Future<AzResponse> put(String path, { Map<String, dynamic>? body, Map<String, String>? headers, bool requiresAuth = true }) =>
      callService(path, method: 'PUT', body: body, headers: headers, requiresAuth: requiresAuth);
  Future<AzResponse> delete(String path, { Map<String, String>? headers, bool requiresAuth = true }) =>
      callService(path, method: 'DELETE', headers: headers, requiresAuth: requiresAuth);
}

class AzResponse {
  final bool success;
  final Map<String, dynamic> data;
  final String? error;
  final int statusCode;
  const AzResponse._({ required this.success, required this.data, this.error, required this.statusCode });
  factory AzResponse.success(Map<String, dynamic> data, int code) => AzResponse._(success: true,  data: data, error: null,  statusCode: code);
  factory AzResponse.error(String error, int code)                 => AzResponse._(success: false, data: {},   error: error, statusCode: code);
  T? get<T>(String key) => data[key] as T?;
  List<T> getList<T>(String key) => (data[key] as List?)?.cast<T>() ?? [];
}
""";
    }

    private String buildCrypto() {
        return """
// Appzillon-New — az_crypto.dart
// Encryption / Decryption — Locked System File
// DO NOT MODIFY — IP of Appzillon-New IDE

import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:crypto/crypto.dart';
import 'az_logger.dart';

class AzCrypto {
  AzCrypto._();
  static final AzCrypto instance = AzCrypto._();
  static String _aesKey = '';
  static void configure({ required String aesKey }) => _aesKey = aesKey;

  String encrypt(String plainText) {
    if (_aesKey.isEmpty) { AzLogger.warn('AzCrypto: no key set'); return plainText; }
    try {
      final key  = _deriveKey(_aesKey);
      final iv   = _generateIV();
      final enc  = _transform(utf8.encode(plainText), key, iv);
      return base64.encode(Uint8List.fromList([...iv, ...enc]));
    } catch (e) { AzLogger.error('encrypt: $e'); return plainText; }
  }

  String decrypt(String cipher) {
    if (_aesKey.isEmpty) return cipher;
    try {
      final raw = base64.decode(cipher);
      final iv  = raw.sublist(0, 16);
      final enc = raw.sublist(16);
      return utf8.decode(_transform(enc, _deriveKey(_aesKey), iv));
    } catch (e) { AzLogger.error('decrypt: $e'); return cipher; }
  }

  String hashSha256(String s) => sha256.convert(utf8.encode(s)).toString();
  String hashMd5(String s)    => md5.convert(utf8.encode(s)).toString();
  String generateToken({ int length = 32 }) {
    const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    final r = Random.secure();
    return List.generate(length, (_) => c[r.nextInt(c.length)]).join();
  }

  Uint8List _deriveKey(String k) => Uint8List.fromList(sha256.convert(utf8.encode(k)).bytes);
  Uint8List _generateIV() { final r = Random.secure(); return Uint8List.fromList(List.generate(16, (_) => r.nextInt(256))); }
  List<int> _transform(List<int> data, Uint8List key, Uint8List iv) =>
      data.asMap().entries.map((e) => e.value ^ key[e.key % key.length] ^ iv[e.key % iv.length]).toList();
}
""";
    }

    private String buildStorage() {
        return """
// Appzillon-New — az_storage.dart
// Local Storage Helper — Locked System File
// DO NOT MODIFY — IP of Appzillon-New IDE

import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'az_crypto.dart';
import 'az_logger.dart';

class AzStorage {
  AzStorage._();
  static final AzStorage instance = AzStorage._();
  static bool _encrypt = false;
  static void configure({ bool encryptValues = false }) => _encrypt = encryptValues;

  Future<bool> save(String key, String value) async {
    try { final p = await SharedPreferences.getInstance(); return p.setString(key, _encrypt ? AzCrypto.instance.encrypt(value) : value); }
    catch (e) { AzLogger.error('AzStorage.save: $e'); return false; }
  }
  Future<bool> saveJson(String key, Map<String, dynamic> v) => save(key, jsonEncode(v));
  Future<String?> get(String key) async {
    try { final p = await SharedPreferences.getInstance(); final v = p.getString(key); if (v == null) return null; return _encrypt ? AzCrypto.instance.decrypt(v) : v; }
    catch (e) { AzLogger.error('AzStorage.get: $e'); return null; }
  }
  Future<Map<String, dynamic>?> getJson(String key) async {
    final v = await get(key); if (v == null) return null;
    try { return jsonDecode(v) as Map<String, dynamic>; } catch (_) { return null; }
  }
  Future<String> getOrDefault(String key, String def) async => (await get(key)) ?? def;
  Future<bool> has(String key) async { final p = await SharedPreferences.getInstance(); return p.containsKey(key); }
  Future<bool> remove(String key) async { final p = await SharedPreferences.getInstance(); return p.remove(key); }
  Future<bool> clear() async { final p = await SharedPreferences.getInstance(); return p.clear(); }
  Future<Set<String>> keys() async { final p = await SharedPreferences.getInstance(); return p.getKeys(); }
}
""";
    }

    private String buildSession() {
        return """
// Appzillon-New — az_session.dart
// Session / Auth Token Manager — Locked System File
// DO NOT MODIFY — IP of Appzillon-New IDE

import 'az_storage.dart';
import 'az_logger.dart';

class AzSession {
  AzSession._();
  static final AzSession instance = AzSession._();
  static const _tokenKey = '_az_token';
  static const _userKey  = '_az_user';
  static const _expKey   = '_az_expiry';
  String? _token;
  Map<String, dynamic>? _user;

  Future<void> saveSession({ required String token, Map<String, dynamic>? user, DateTime? expiresAt }) async {
    _token = token; _user = user;
    await AzStorage.instance.save(_tokenKey, token);
    if (user      != null) await AzStorage.instance.saveJson(_userKey, user);
    if (expiresAt != null) await AzStorage.instance.save(_expKey, expiresAt.toIso8601String());
    AzLogger.info('AzSession: saved');
  }

  Future<bool> loadSession() async {
    _token = await AzStorage.instance.get(_tokenKey);
    _user  = await AzStorage.instance.getJson(_userKey);
    if (_token == null) return false;
    if (await isExpired()) { await clearSession(); return false; }
    AzLogger.info('AzSession: loaded');
    return true;
  }

  String? getToken() => _token;
  Map<String, dynamic>? getUser() => _user;
  T? getUserField<T>(String f) => _user?[f] as T?;
  bool get isLoggedIn => _token != null;

  Future<bool> isExpired() async {
    final e = await AzStorage.instance.get(_expKey);
    if (e == null) return false;
    return DateTime.parse(e).isBefore(DateTime.now());
  }

  Future<void> clearSession() async {
    _token = null; _user = null;
    await AzStorage.instance.remove(_tokenKey);
    await AzStorage.instance.remove(_userKey);
    await AzStorage.instance.remove(_expKey);
    AzLogger.info('AzSession: cleared');
  }
}
""";
    }

    private String buildUpload() {
        return """
// Appzillon-New — az_upload.dart
// File Upload Helper — Locked System File
// DO NOT MODIFY — IP of Appzillon-New IDE

import 'dart:io';
import 'package:http/http.dart' as http;
import 'az_session.dart';
import 'az_logger.dart';

class AzUpload {
  AzUpload._();
  static final AzUpload instance = AzUpload._();
  static String _endpoint = '';
  static void configure({ required String uploadEndpoint }) => _endpoint = uploadEndpoint;

  Future<AzUploadResult> uploadFile(String filePath, {
    String fieldName = 'file',
    Map<String, String>? extraFields,
    String? customEndpoint,
  }) async {
    final url  = customEndpoint ?? _endpoint;
    final file = File(filePath);
    if (!await file.exists()) return AzUploadResult.error('File not found: $filePath');
    final token   = AzSession.instance.getToken();
    final request = http.MultipartRequest('POST', Uri.parse(url));
    if (token != null) request.headers['Authorization'] = 'Bearer $token';
    request.files.add(await http.MultipartFile.fromPath(fieldName, filePath));
    if (extraFields != null) request.fields.addAll(extraFields);
    AzLogger.debug('Uploading $filePath → $url');
    try {
      final resp = await http.Response.fromStream(await request.send());
      return resp.statusCode >= 200 && resp.statusCode < 300
          ? AzUploadResult.success(resp.body, resp.statusCode)
          : AzUploadResult.error('Upload failed: ${resp.statusCode}');
    } catch (e) { AzLogger.error('upload: $e'); return AzUploadResult.error('Upload error: $e'); }
  }

  Future<List<AzUploadResult>> uploadFiles(List<String> paths, { String fieldName = 'files', String? customEndpoint }) =>
      Future.wait(paths.map((p) => uploadFile(p, fieldName: fieldName, customEndpoint: customEndpoint)));
}

class AzUploadResult {
  final bool success; final String? body; final String? error; final int statusCode;
  const AzUploadResult._({ required this.success, this.body, this.error, required this.statusCode });
  factory AzUploadResult.success(String body, int code) => AzUploadResult._(success: true,  body: body,  statusCode: code);
  factory AzUploadResult.error(String err)              => AzUploadResult._(success: false, error: err,  statusCode: 0);
}
""";
    }

    private String buildNotifications() {
        return """
// Appzillon-New — az_notifications.dart
// Push Notification Handler — Locked System File
// DO NOT MODIFY — IP of Appzillon-New IDE

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

  void configure({ NotificationHandler? onMessage, NotificationHandler? onTap }) {
    _onMessage = onMessage; _onTap = onTap;
    AzLogger.info('AzNotifications configured');
  }

  Future<String?> getToken() async {
    _fcmToken ??= await AzStorage.instance.get(_tokenKey);
    return _fcmToken;
  }

  Future<void> saveToken(String token) async {
    _fcmToken = token;
    await AzStorage.instance.save(_tokenKey, token);
    AzLogger.info('AzNotifications: FCM token saved');
  }

  void handleMessage(Map<String, dynamic> data) { AzLogger.debug('Notification: $data'); _onMessage?.call(data); }
  void handleTap(Map<String, dynamic> data)     { AzLogger.debug('Notification tap: $data'); _onTap?.call(data); }
  String? getRoute(Map<String, dynamic> data)   => data['route'] as String?;
  Map<String, dynamic> getPayload(Map<String, dynamic> data) => (data['payload'] as Map?)?.cast<String, dynamic>() ?? {};
}
""";
    }

    private String buildConnectivity() {
        return """
// Appzillon-New — az_connectivity.dart
// Connectivity Checker — Locked System File
// DO NOT MODIFY — IP of Appzillon-New IDE

import 'dart:async';
import 'dart:io';
import 'az_logger.dart';

class AzConnectivity {
  AzConnectivity._();
  static final AzConnectivity instance = AzConnectivity._();
  bool _isOnline = true;
  StreamController<bool>? _controller;
  Timer? _timer;

  bool get isOnline  => _isOnline;
  bool get isOffline => !_isOnline;
  Stream<bool> get onConnectivityChanged { _controller ??= StreamController<bool>.broadcast(); return _controller!.stream; }

  void startMonitoring({ int intervalSeconds = 5, String? testHost }) {
    _timer?.cancel();
    _timer = Timer.periodic(Duration(seconds: intervalSeconds), (_) async {
      final online = await checkConnection(testHost: testHost);
      if (online != _isOnline) { _isOnline = online; _controller?.add(online); AzLogger.info('Connectivity: ${online ? 'ONLINE' : 'OFFLINE'}'); }
    });
  }

  void stopMonitoring() { _timer?.cancel(); _timer = null; }

  Future<bool> checkConnection({ String? testHost }) async {
    try {
      final r = await InternetAddress.lookup(testHost ?? 'google.com').timeout(const Duration(seconds: 5));
      return r.isNotEmpty && r[0].rawAddress.isNotEmpty;
    } catch (_) { return false; }
  }

  void dispose() { stopMonitoring(); _controller?.close(); }
}
""";
    }

    private String buildDevice() {
        return """
// Appzillon-New — az_device.dart
// Device Info — Locked System File
// DO NOT MODIFY — IP of Appzillon-New IDE

import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'az_logger.dart';

class AzDevice {
  AzDevice._();
  static final AzDevice instance = AzDevice._();
  Map<String, dynamic>? _cached;

  Future<Map<String, dynamic>> getInfo() async {
    if (_cached != null) return _cached!;
    try {
      final d = DeviceInfoPlugin();
      final p = await PackageInfo.fromPlatform();
      final info = <String, dynamic>{ 'appName': p.appName, 'packageName': p.packageName, 'version': p.version, 'buildNumber': p.buildNumber, 'platform': Platform.operatingSystem };
      if (Platform.isAndroid) {
        final a = await d.androidInfo;
        info.addAll({ 'deviceId': a.id, 'model': a.model, 'brand': a.brand, 'osVersion': a.version.release, 'sdkVersion': a.version.sdkInt.toString(), 'isPhysical': a.isPhysicalDevice });
      } else if (Platform.isIOS) {
        final i = await d.iosInfo;
        info.addAll({ 'deviceId': i.identifierForVendor ?? '', 'model': i.model, 'osVersion': i.systemVersion, 'isPhysical': i.isPhysicalDevice });
      }
      _cached = info;
      return info;
    } catch (e) { AzLogger.error('AzDevice: $e'); return {'platform': Platform.operatingSystem}; }
  }

  Future<String> getDeviceId()   async => (await getInfo())['deviceId']  ?? '';
  Future<String> getModel()      async => (await getInfo())['model']      ?? '';
  Future<String> getOsVersion()  async => (await getInfo())['osVersion']  ?? '';
  Future<String> getAppVersion() async => (await getInfo())['version']    ?? '';
  Future<bool>   isPhysical()    async => (await getInfo())['isPhysical'] as bool? ?? true;
  bool get isAndroid => Platform.isAndroid;
  bool get isIOS     => Platform.isIOS;
}
""";
    }

    private String buildLogger() {
        return """
// Appzillon-New — az_logger.dart
// Structured Logger — Locked System File
// DO NOT MODIFY — IP of Appzillon-New IDE

import 'dart:developer' as developer;

enum AzLogLevel { debug, info, warn, error, none }

class AzLogger {
  static AzLogLevel _level = AzLogLevel.debug;
  static bool _ts = true;
  static final List<String> _buf = [];
  static int _max = 500;

  static void configure({ AzLogLevel level = AzLogLevel.debug, bool showTimestamp = true, int maxBufferLines = 500 }) {
    _level = level; _ts = showTimestamp; _max = maxBufferLines;
  }

  static void debug(String m) => _log(AzLogLevel.debug, m);
  static void info(String m)  => _log(AzLogLevel.info,  m);
  static void warn(String m)  => _log(AzLogLevel.warn,  m);
  static void error(String m) => _log(AzLogLevel.error, m);

  static void _log(AzLogLevel level, String msg) {
    if (level.index < _level.index) return;
    final prefix = _ts ? '[AZ ${DateTime.now().toIso8601String().substring(11, 19)}]' : '[AZ]';
    final icon   = switch(level) { AzLogLevel.debug => '🔍', AzLogLevel.info => 'ℹ', AzLogLevel.warn => '⚠', AzLogLevel.error => '❌', _ => '' };
    final line   = '$prefix $icon $msg';
    developer.log(line, name: 'Appzillon-New');
    _buf.add(line);
    if (_buf.length > _max) _buf.removeAt(0);
  }

  static List<String> getLogs()  => List.unmodifiable(_buf);
  static void clearLogs()        => _buf.clear();
}
""";
    }

    private String buildUtils() {
        return """
// Appzillon-New — az_utils.dart
// Utility Functions — Locked System File
// DO NOT MODIFY — IP of Appzillon-New IDE

import 'dart:math';

class AzUtils {
  AzUtils._();

  static const _months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  static String formatDate(DateTime d)     => '${d.day.toString().padLeft(2,'0')} ${_months[d.month-1]} ${d.year}';
  static String formatTime(DateTime d)     { final h = d.hour > 12 ? d.hour-12 : (d.hour==0?12:d.hour); return '${h}:${d.minute.toString().padLeft(2,'0')} ${d.hour>=12?'PM':'AM'}'; }
  static String formatDateTime(DateTime d) => '${formatDate(d)} ${formatTime(d)}';

  static String timeAgo(DateTime d) {
    final diff = DateTime.now().difference(d);
    if (diff.inSeconds < 60)  return 'just now';
    if (diff.inMinutes < 60)  return '${diff.inMinutes}m ago';
    if (diff.inHours   < 24)  return '${diff.inHours}h ago';
    if (diff.inDays    < 7)   return '${diff.inDays}d ago';
    return formatDate(d);
  }

  static DateTime? parseDate(String? s) { if (s==null) return null; try { return DateTime.parse(s); } catch (_) { return null; } }
  static String capitalize(String s)    => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
  static String toTitleCase(String s)   => s.split(' ').map(capitalize).join(' ');
  static String truncate(String s, int n) => s.length <= n ? s : '\\${s.substring(0, n)}…';
  static String removeSpaces(String s)  => s.replaceAll(RegExp(r'\\s+'), '');
  static bool   isEmail(String s)       => RegExp(r'^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$').hasMatch(s);
  static bool   isPhone(String s)       => RegExp(r'^\\+?[0-9]{7,15}$').hasMatch(s.replaceAll(RegExp(r'[\\s-()]'), ''));
  static bool   isBlank(String? s)      => s == null || s.trim().isEmpty;
  static String generateUuid() {
    final r = Random.secure();
    final b = List.generate(16, (_) => r.nextInt(256));
    b[6]=(b[6]&0x0f)|0x40; b[8]=(b[8]&0x3f)|0x80;
    String h(int v) => v.toRadixString(16).padLeft(2,'0');
    return '${b.sublist(0,4).map(h).join()}-${b.sublist(4,6).map(h).join()}-${b.sublist(6,8).map(h).join()}-${b.sublist(8,10).map(h).join()}-${b.sublist(10).map(h).join()}';
  }
  static String formatCurrency(double a, { String symbol = '₹', int decimals = 2 }) {
    final parts = a.toStringAsFixed(decimals).split('.');
    final digits = parts[0].split('').reversed.toList();
    final groups = <String>[];
    for (int i=0; i<digits.length; i+=3) groups.add(digits.skip(i).take(3).toList().reversed.join());
    return '$symbol${groups.reversed.join(',')}.${parts.length>1?parts[1]:'00'}';
  }
}
""";
    }

    private String buildPainter() {
        return """
// Appzillon-New — az_painter.dart
// Canvas Data Painter — Locked System File
// DO NOT MODIFY — IP of Appzillon-New IDE
//
// DEVELOPER USAGE:
//   After calling AzServer and processing your data, call:
//     AzPainter.paint(screenId: 'MyScreen', interfaceId: 'getItems', data: processedList);
//   Widgets bound to that interface will rebuild automatically with the new data.

import 'package:flutter_riverpod/flutter_riverpod.dart';

// ── Internal state — keyed by "screenId__interfaceId" ────────────────────────
class _AzPainterNotifier extends StateNotifier<Map<String, dynamic>> {
  _AzPainterNotifier() : super(const {});

  void paint(String screenId, String interfaceId, dynamic data) {
    final key = '${screenId}__${interfaceId}';
    state = Map<String, dynamic>.from(state)..[key] = data;
  }

  dynamic read(String screenId, String interfaceId) {
    return state['${screenId}__${interfaceId}'];
  }
}

final _azPainterProvider =
    StateNotifierProvider<_AzPainterNotifier, Map<String, dynamic>>(
  (_) => _AzPainterNotifier(),
);

// ── Public API — used by developer in screen controller ──────────────────────
class AzPainter {
  AzPainter._();

  static ProviderContainer? _container;

  /// Called once in main.dart by the system — developer does not call this.
  static void init(ProviderContainer container) => _container = container;

  /// Called by developer after fetching and processing API data.
  ///
  /// [screenId]    — the screen class name, e.g. 'TransactionsScreen'
  /// [interfaceId] — the interface name defined in the IDE, e.g. 'getTransactions'
  /// [data]        — the processed data: a List<dynamic> for list screens,
  ///                 or Map<String,dynamic> for detail screens.
  ///
  /// Example:
  ///   AzPainter.paint(
  ///     screenId:    'TransactionsScreen',
  ///     interfaceId: 'getTransactions',
  ///     data:        filteredAndSortedList,
  ///   );
  static void paint({
    required String screenId,
    required String interfaceId,
    required dynamic data,
  }) {
    assert(_container != null,
        'AzPainter.init() must be called before AzPainter.paint(). '
        'This is done automatically by the system in main.dart.');
    _container!.read(_azPainterProvider.notifier).paint(screenId, interfaceId, data);
  }
}

// ── Provider watched by generated widget classes ──────────────────────────────
// The generated Widget class watches this provider to rebuild when paint() is called.
// Developer does not use this directly.
final azPainterProvider = _azPainterProvider;
""";
    }

    private String buildBarrel() {
        return """
// Appzillon-New — appzillon.dart
// System Library Barrel Export — Locked System File
// DO NOT MODIFY — IP of Appzillon-New IDE
//
// DEVELOPER USAGE:
//   import 'package:your_app/appzillon/appzillon.dart';
//
// Then call any system method:
//   AzServer.configure(baseUrl: 'http://your-api.com');
//   final res = await AzServer.instance.post('/api/v1/login', body: {...});
//   await AzSession.instance.saveSession(token: res.get('token')!);
//   AzLogger.info('Logged in!');

export 'az_server.dart';
export 'az_crypto.dart';
export 'az_storage.dart';
export 'az_session.dart';
export 'az_upload.dart';
export 'az_notifications.dart';
export 'az_connectivity.dart';
export 'az_device.dart';
export 'az_logger.dart';
export 'az_utils.dart';
export 'az_painter.dart';
export 'az_biometric.dart';
""";
    }

    private String buildBiometric() {
        return """
// Appzillon-New — az_biometric.dart
// Biometric Authentication — Fingerprint, Face ID, Device PIN
// Locked System File — DO NOT MODIFY
// Uses: local_auth: ^2.1.8
//
// USAGE:
//   final available = await AzBiometric.isAvailable();
//   final result = await AzBiometric.authenticate(reason: 'Sign in to FinEdge Bank');
//   if (result.success) { /* proceed */ }
//
//   // Save credentials after first MPIN login
//   await AzBiometric.saveCredentials(customerId: 'CID123', token: 'jwt...');
//
//   // Biometric re-login
//   final creds = await AzBiometric.loadCredentials();
//
// Android — AndroidManifest.xml:
//   <uses-permission android:name="android.permission.USE_BIOMETRIC"/>
// iOS — Info.plist:
//   <key>NSFaceIDUsageDescription</key>
//   <string>We use Face ID to authenticate you securely.</string>

import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';
import 'package:local_auth/error_codes.dart' as auth_error;
import 'az_storage.dart';
import 'az_logger.dart';

// ── Result type ────────────────────────────────────────────────────────────
class AzBiometricResult {
  final bool success;
  final String? errorCode;
  final String? errorMessage;
  const AzBiometricResult({required this.success, this.errorCode, this.errorMessage});
  factory AzBiometricResult.ok() => const AzBiometricResult(success: true);
  factory AzBiometricResult.error(String code, String msg) =>
      AzBiometricResult(success: false, errorCode: code, errorMessage: msg);
}

// ── AzBiometric ────────────────────────────────────────────────────────────
class AzBiometric {
  AzBiometric._();
  static final _auth = LocalAuthentication();

  // Storage keys — stored via AzStorage.save/get
  static const _kCidKey      = 'az_bio_cid';
  static const _kTokenKey    = 'az_bio_token';
  static const _kEnabledKey  = 'az_bio_enabled';

  // ── Availability ───────────────────────────────────────────────────────
  static Future<bool> isAvailable() async {
    try {
      final canCheck    = await _auth.canCheckBiometrics;
      final isSupported = await _auth.isDeviceSupported();
      if (!canCheck || !isSupported) return false;
      final types = await _auth.getAvailableBiometrics();
      return types.isNotEmpty;
    } catch (e) { AzLogger.warn('AzBiometric.isAvailable: $e'); return false; }
  }

  static Future<List<BiometricType>> getAvailableTypes() async {
    try { return await _auth.getAvailableBiometrics(); } catch (_) { return []; }
  }

  static Future<String> getBiometricLabel() async {
    final types = await getAvailableTypes();
    if (types.contains(BiometricType.face))        return 'Face ID';
    if (types.contains(BiometricType.fingerprint)) return 'Fingerprint';
    if (types.contains(BiometricType.strong))      return 'Biometrics';
    return 'Biometrics';
  }

  // ── Authenticate ───────────────────────────────────────────────────────
  static Future<AzBiometricResult> authenticate({
    String reason        = 'Verify your identity to continue',
    bool biometricOnly   = false,
    bool stickyAuth      = true,
  }) async {
    try {
      final ok = await _auth.authenticate(
        localizedReason: reason,
        options: AuthenticationOptions(
          biometricOnly:      biometricOnly,
          stickyAuth:         stickyAuth,
          useErrorDialogs:    true,
          sensitiveTransaction: true,
        ),
      );
      if (ok) { AzLogger.info('AzBiometric: authenticated'); return AzBiometricResult.ok(); }
      return AzBiometricResult.error('user_cancelled', 'Authentication cancelled');
    } on PlatformException catch (e) {
      AzLogger.warn('AzBiometric PlatformException: ${e.code}');
      String msg;
      switch (e.code) {
        case auth_error.notAvailable:         msg = 'Biometric not available on this device.'; break;
        case auth_error.notEnrolled:          msg = 'No biometrics enrolled. Set up in Settings.'; break;
        case auth_error.lockedOut:            msg = 'Too many attempts. Try again in 30 seconds.'; break;
        case auth_error.permanentlyLockedOut: msg = 'Biometrics locked. Unlock device with PIN first.'; break;
        case auth_error.passcodeNotSet:       msg = 'No device PIN set. Secure your device first.'; break;
        default: msg = e.message ?? 'Authentication failed (${e.code})';
      }
      return AzBiometricResult.error(e.code, msg);
    } catch (e) {
      AzLogger.error('AzBiometric: $e');
      return AzBiometricResult.error('unknown', e.toString());
    }
  }

  static Future<void> cancel() async {
    try { await _auth.stopAuthentication(); } catch (_) {}
  }

  // ── Credentials store (uses AzStorage.save/get/remove) ────────────────
  static Future<void> saveCredentials({ required String customerId, required String token }) async {
    await AzStorage.instance.save(_kCidKey,     customerId);
    await AzStorage.instance.save(_kTokenKey,   token);
    await AzStorage.instance.save(_kEnabledKey, 'true');
    AzLogger.info('AzBiometric: credentials saved for $customerId');
  }

  static Future<Map<String, String>?> loadCredentials() async {
    final enabled = await AzStorage.instance.get(_kEnabledKey);
    if (enabled != 'true') return null;
    final cid   = await AzStorage.instance.get(_kCidKey);
    final token = await AzStorage.instance.get(_kTokenKey);
    if (cid == null || token == null) return null;
    return {'customerId': cid, 'token': token};
  }

  static Future<bool> isEnabled() async {
    final enabled = await AzStorage.instance.get(_kEnabledKey);
    if (enabled != 'true') return false;
    final cid = await AzStorage.instance.get(_kCidKey);
    return cid != null;
  }

  static Future<void> disable() async {
    await AzStorage.instance.remove(_kCidKey);
    await AzStorage.instance.remove(_kTokenKey);
    await AzStorage.instance.save(_kEnabledKey, 'false');
    AzLogger.info('AzBiometric: disabled');
  }
}
""";
    }

    private void write(Path path, String content, GenerationResult result) throws IOException {
        Files.createDirectories(path.getParent());
        Files.writeString(path, content, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        result.getGeneratedFiles().add(path.toString());
    }
}
