# Guía para ver More Stock en Android

La app de depuración se conecta al backend local por `http://10.0.2.2:3000/api/v1` cuando se ejecuta en el emulador Android. Para estas instrucciones, el backend debe usar la base aislada `more_stock_codex_test`.

## 1. Iniciar la API de demostración

Confirma que MySQL local esté encendido y que exista la base `more_stock_codex_test`. En una terminal:

```sh
cd /home/tako/Escritorio/MoreStock/Backend
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
/home/tako/Android/Sdk/emulator/emulator -avd ReactNative_API_36 -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect -accel off
```

Ese comando sirve para obtener capturas con `adb`, no para ver una ventana del emulador. Deja la terminal abierta. En otra terminal, espera el dispositivo y confirma que Android terminó de iniciar:

```sh
/home/tako/Android/Sdk/platform-tools/adb wait-for-device
/home/tako/Android/Sdk/platform-tools/adb shell getprop sys.boot_completed
```

El segundo comando debe responder `1`.

## 3. Compilar, instalar y abrir

En otra terminal:

```sh
cd /home/tako/Escritorio/MoreStock/FrontEnd
./gradlew :app:assembleDebug
/home/tako/Android/Sdk/platform-tools/adb install -r app/build/outputs/apk/debug/app-debug.apk
/home/tako/Android/Sdk/platform-tools/adb shell am start -n com.morestock.app/.MainActivity
```

El APK queda en `FrontEnd/app/build/outputs/apk/debug/app-debug.apk`. Para iniciar sesión, consulta la cuenta demo configurada en `DEMO_ACCOUNTS_JSON` dentro de `Backend/.env`. La contraseña no se copia a esta guía ni a las capturas.

## 4. Capturar una pantalla

Con la pantalla que quieras documentar visible:

```sh
mkdir -p /home/tako/Escritorio/MoreStock/docs/ui/antes
/home/tako/Android/Sdk/platform-tools/adb exec-out screencap -p > /home/tako/Escritorio/MoreStock/docs/ui/antes/login-captura.png
```

## Resultado de ejecución en este equipo

Se comprobó el arranque del backend contra `more_stock_codex_test`, la respuesta de `/api/v1/health`, la instalación del APK y la pantalla real de inicio de sesión. También se guardó el estado real de validación de correo en `antes/login-validacion-correo.png`. Se verificaron por separado los pasos de API, emulador, instalación y lanzamiento; el recorrido autenticado no pudo verificarse por los bloqueos descritos abajo.

El AVD Android 36 está instalado, pero en este entorno no hay aceleración de hardware. Durante el intento de interacción, Android mostró bloqueos de **System UI** y de **More Stock**; por eso no se consideran válidas capturas de flujos posteriores al login ni se afirma que se haya completado un recorrido visual. La evidencia del bloqueo está en `antes/emulador_anr_system_ui.png` y `antes/morestock-anr-al-enviar.png`.

## Pantallas que aún no existen en la app

El código actual incluye login, selección de negocio, inicio/resumen, catálogo, inventario de solo lectura, sugerencias y detalle de producto. No hay pantalla de registro ni perfil; tampoco hay una pantalla de edición de inventario ni una gráfica dibujada. El detalle muestra historial y puntos pronosticados como listas. Por eso no es posible obtener capturas reales de esas pantallas sin implementarlas.
