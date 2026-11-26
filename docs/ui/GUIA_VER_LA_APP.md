# Guía para ver More Stock en Android

La app de depuración se conecta al backend local por `http://10.0.2.2:3000/api/v1` cuando se ejecuta en el emulador Android. Ejecuta los comandos desde la raíz del repositorio, salvo cuando se indique otra carpeta. El backend debe usar la base aislada `more_stock_codex_test`.

## 1. Iniciar la API de demostración

Confirma que MySQL local esté encendido y que exista la base `more_stock_codex_test`. En una terminal, instala primero las dependencias del backend y luego inicia la API:

```sh
cd Backend
npm ci
NODE_ENV=development DEMO_MODE=true DB_NAME=more_stock_codex_test PORT=3000 npm start
```

Espera el mensaje `MySQL listo` y comprueba la ruta de salud desde otra terminal:

```sh
curl --fail http://127.0.0.1:3000/api/v1/health
```

La respuesta confirma que el proceso HTTP responde; el mensaje `MySQL listo` confirma que el arranque completó la conexión y carga inicial. `DB_NAME` debe permanecer en `more_stock_codex_test` para esta demostración.

## 2. Iniciar el emulador

Para ver la app, en Android Studio abre **Device Manager** e inicia `ReactNative_API_36`. Durante la captura de evidencia en este equipo, el mismo AVD se inició sin ventana con aceleración por software:

```sh
"${ANDROID_HOME:-$HOME/Android/Sdk}/emulator/emulator" -avd ReactNative_API_36 -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect -accel off
```

Ese comando sirve para obtener capturas con `adb`, no para ver una ventana del emulador. Deja la terminal abierta. En otra terminal, espera el dispositivo y confirma que Android terminó de iniciar:

```sh
"${ANDROID_HOME:-$HOME/Android/Sdk}/platform-tools/adb" wait-for-device
"${ANDROID_HOME:-$HOME/Android/Sdk}/platform-tools/adb" shell getprop sys.boot_completed
```

El segundo comando debe responder `1`.

## 3. Compilar, instalar y abrir

En otra terminal:

```sh
cd FrontEnd
./gradlew :app:assembleDebug
"${ANDROID_HOME:-$HOME/Android/Sdk}/platform-tools/adb" install -r app/build/outputs/apk/debug/app-debug.apk
"${ANDROID_HOME:-$HOME/Android/Sdk}/platform-tools/adb" shell am start -n com.morestock.app/.MainActivity
```

El APK queda en `FrontEnd/app/build/outputs/apk/debug/app-debug.apk`. En la pantalla de inicio puedes elegir **Crear cuenta** para registrar un negocio de demostración. Para usar una cuenta ya configurada, consulta `DEMO_ACCOUNTS_JSON` en `Backend/.env`; la contraseña no se copia a esta guía ni a las capturas.

## 4. Capturas disponibles

Las capturas iniciales reales están en `docs/ui/antes/`. Las capturas posteriores reales del acceso están en `docs/ui/despues/login.png` y `docs/ui/despues/registro.png`. No se presentan como capturas posteriores las pantallas de ANR guardadas en `antes/`.

Con la pantalla de inicio de sesión visible, puedes guardar una nueva captura en la carpeta de resultados:

```sh
"${ANDROID_HOME:-$HOME/Android/Sdk}/platform-tools/adb" exec-out screencap -p > docs/ui/despues/login-captura-local.png
```

## Resultado de ejecución

En la fase inicial se inició el backend con la base aislada `more_stock_codex_test`, se comprobó `/api/v1/health` y se abrió la pantalla de inicio de sesión. Las capturas iniciales válidas son `antes/login.png` y `antes/login-validacion-correo.png`.

Las capturas `despues/login.png` y `despues/registro.png` son pantallas reales de acceso obtenidas durante U4. En U9 se volvió a iniciar `ReactNative_API_36` con renderizado por software. `adb` detectó el dispositivo y encontró WindowManager, pero Android no informó que terminara el arranque y la instalación respondió `device is still booting`. Por ello no se actualizaron las capturas ni se verificó el recorrido posterior al acceso. Las capturas de ANR en `antes/` documentan bloqueos del entorno y no se usan como pantallas de la app.

No se recibió una cuenta demo utilizable durante la ejecución de la Fase 10. La contraseña no se incluye en esta guía. Para autenticarse, consulta en privado la configuración local de `DEMO_ACCOUNTS_JSON` o usa una cuenta ya preparada en la base aislada.

## Interfaz incluida en el APK debug

La versión actual incluye inicio de sesión, registro, selección de negocio, resumen, catálogo, edición del inventario, sugerencias, detalle de producto con gráfica de histórico y pronóstico, y la pestaña Cuenta con negocio activo, rol, cambio de negocio y salida confirmada. El editor muestra siempre la unidad y detecta si el inventario cambió antes de guardarlo. La gráfica distingue el historial del pronóstico y marca los datos sintéticos cuando la API lo indica.
