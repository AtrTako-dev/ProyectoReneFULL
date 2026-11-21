# Pendientes para despliegue

El proyecto está preparado localmente. No se creó un clúster, no se configuró un servicio de Render, no se conectó la aplicación a infraestructura remota y no se firmó ni publicó un APK release.

## TiDB Cloud

1. Elegir y crear el tipo de clúster requerido por la cuenta.
2. Confirmar las instrucciones TLS del tipo de clúster. El backend ya admite `DB_SSL=true` y solicita TLS 1.2 como mínimo. No existe todavía una variable para cargar una CA propia. Si el clúster elegido requiere una CA dedicada, habrá que agregar esa configuración segura antes de conectar.
3. Crear un usuario de base con los permisos mínimos para las operaciones del backend. El proceso inicializa el esquema y requiere `CREATE` y `ALTER` además de lectura y escritura.
4. Preparar el catálogo, surtidos, usuarios y datos de venta que se usarán en la demostración. Los CSV incluidos son sintéticos y no deben presentarse como ventas reales.

## Render

El Blueprint `render.yaml` tiene `autoDeployTrigger` desactivado. Cuando se decida desplegar, completar en la configuración del servicio las variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` y `DB_SSL`. El Blueprint fija `DB_PORT=4000`, `DB_SSL=true`, `NODE_ENV=production` y `DEMO_MODE=false`; las contraseñas se ingresan en el panel y no se guardan en Git.

Antes de activar el límite de intentos detrás de un proxy, verificar la ruta real de entrada. Solo si un proxy confiable sobrescribe `CF-Connecting-IP` y no existe un acceso alterno falsificable, configurar `LOGIN_RATE_LIMIT_CLIENT_IP_HEADER=CF-Connecting-IP`. No usar `X-Forwarded-For` sin verificar cómo se sanea.

Después de configurar los secretos, iniciar manualmente el servicio y comprobar la ruta de salud, el inicio de sesión, los permisos por negocio, los datos y la conexión TLS. El endpoint de salud solo confirma que responde el proceso HTTP; no demuestra disponibilidad de MySQL.

## URL HTTPS y APK release

1. Definir la URL HTTPS pública de la API.
2. Configurar `morestock.apiBaseUrl` con esa URL para la variante release. La dirección `http://10.0.2.2:3000/api/v1` es exclusiva del emulador local.
3. Crear y resguardar una clave de firma fuera del repositorio, preparar la configuración de firma de Android y generar el APK release firmado.
4. Probar el APK firmado contra la API HTTPS antes de distribuirlo.

El APK debug local está disponible en `FrontEnd/app/build/outputs/apk/debug/app-debug.apk`. No es una versión de producción ni está firmada para distribución.
