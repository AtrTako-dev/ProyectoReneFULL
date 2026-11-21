# Investigación técnica de Fase 8

**Fecha:** 20 de noviembre de 2026  
**Alcance:** lectura de la configuración versionada de MoreStock y contraste con documentación oficial. No se leyeron valores de secretos, no se modificó código/configuración ni se publicó el servicio.

## Render

En `render.yaml`, el servicio Node usa `rootDir: Backend`, `buildCommand: npm ci`, `startCommand: npm start`, `NODE_VERSION: 24.22.1`, `healthCheckPath: /api/v1/health` y `autoDeployTrigger: "off"`. El handler local de salud responde HTTP 200. Render define `rootDir` como el directorio raíz del servicio, acepta la ruta HTTP de salud en Blueprints y considera saludables respuestas HTTP 2xx/3xx; `off` deshabilita los despliegues automáticos. [Referencia de Blueprints](https://render.com/docs/blueprint-spec), [chequeos de salud](https://render.com/docs/health-checks).

> “off”: Disable auto-deploys. [Render Blueprint Spec](https://render.com/docs/blueprint-spec)

Render documenta `24.22.1` como versión actual predeterminada y la configuración permite fijarla mediante `NODE_VERSION`; Node.js 24 está en soporte LTS. El paquete del backend declara `node >=22`, así que la versión fijada satisface el rango declarado. [Render: Node.js version](https://render.com/docs/node-version), [Node.js releases](https://nodejs.org/en/about/previous-releases).

`DB_HOST`, `DB_USER`, `DB_PASSWORD` y `DB_NAME` están declaradas con `sync: false`; `DB_PORT` se fija en `4000` y `DB_SSL` en `true`. Render documenta que los valores `sync: false` se solicitan al crear inicialmente el Blueprint y se omiten en sincronizaciones posteriores. Esto evita guardar credenciales en el YAML, pero requiere gestionar cambios de esos valores en el servicio. [Referencia de Blueprints](https://render.com/docs/blueprint-spec).

> “Render prompts you for these values only during the initial Blueprint creation.” [Render Blueprint Spec](https://render.com/docs/blueprint-spec)

## TiDB Cloud y mysql2

El backend crea el pool con `mysql2/promise`, usa el host y credenciales configurados por entorno y habilita `ssl: { minVersion: 'TLSv1.2' }` cuando `DB_SSL=true`. Esto corresponde al puerto `4000` y al mínimo TLS 1.2 de la guía oficial de TiDB. Para TiDB Cloud Starter/Essential mediante endpoint público, TiDB exige TLS y permite omitir CA personalizada al usar el almacén raíz de Node.js. Para TiDB Cloud Dedicated, la documentación indica descargar y configurar el certificado CA del clúster. Como el repositorio no define una CA ni identifica el tipo de clúster, la validación completa del certificado queda condicionada a confirmar que el destino sea Starter/Essential o, si es Dedicated, incorporar su CA de forma segura. No se verificó una conexión real. [Guía oficial de TiDB con `mysql2`](https://docs.pingcap.com/tidb/dev/dev-guide-sample-application-nodejs-mysql2/), [TLS para TiDB Cloud Dedicated](https://docs.pingcap.com/tidbcloud/tidb-cloud-tls-connect-to-dedicated/).

> “TLS connection MUST be enabled” para el endpoint público de TiDB Cloud Starter. [TiDB: Node.js + mysql2](https://docs.pingcap.com/tidb/dev/dev-guide-sample-application-nodejs-mysql2/)

## Compatibilidad Android

Valores versionados en `FrontEnd`: AGP `9.4.1`, Kotlin `2.4.10`, plugin Compose con la misma versión de Kotlin, Compose BOM `2026.09.00`, Gradle Wrapper `9.6.0`, `compileSdk = 37` y compatibilidad Java de compilación `17`.

- **AGP/Gradle/SDK/JDK:** la guía de AGP indica que AGP 9.4 requiere como mínimo Gradle 9.6.0, admite API 37 y requiere JDK 17. El Wrapper y `compileSdk` coinciden con esos requisitos; `compileOptions` fija el bytecode fuente y destino Java 17. La configuración no determina qué JDK ejecutará Gradle en cada máquina. [Compatibilidad AGP](https://developer.android.com/build/releases/about-agp), [notas de AGP 9.4](https://developer.android.com/build/releases/agp-9-4-0-release-notes).
- **Kotlin/Compose Compiler:** Kotlin `2.4.10` es una versión publicada. Compose usa `org.jetbrains.kotlin.plugin.compose` con esa misma versión; Kotlin documenta que el compilador Compose se publica junto con Kotlin y comparte su compatibilidad. AGP 9 incluye soporte Kotlin, y el proyecto no aplica por separado `org.jetbrains.kotlin.android`. [Historial de Kotlin](https://kotlinlang.org/releases.html), [migración del compilador Compose](https://kotlinlang.org/docs/compose-compiler-migration-guide.html), [Kotlin integrado en AGP](https://developer.android.com/build/migrate-to-built-in-kotlin).
- **BOM:** Compose BOM `2026.09.00` es la versión estable que la guía oficial consultada recomienda usar; las dependencias Compose del proyecto dejan que el BOM gestione sus versiones. [Configuración oficial de Compose](https://developer.android.com/develop/ui/compose/setup-compose-dependencies-and-compiler).

> “the Compose compiler ships simultaneously with Kotlin and will always be compatible with Kotlin of the same version.” [Kotlin Compose Compiler Migration Guide](https://kotlinlang.org/docs/compose-compiler-migration-guide.html)

**Hallazgos críticos:** la compatibilidad declarada entre AGP 9.4, Gradle 9.6, API 37 y Java/JDK 17 es coherente; debe confirmarse JDK 17+ en el entorno de compilación. El riesgo pendiente principal es TLS: confirmar el nivel de TiDB y, si es Dedicated, proporcionar su CA sin almacenarla en el repositorio. El Blueprint no despliega automáticamente y `sync: false` no actualiza valores de entorno en sincronizaciones posteriores.
