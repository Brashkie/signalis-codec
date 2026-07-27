# 🦀 @brashkie/signalis-codec — Paquete Nuevo (Rust + NAPI)

## ⚠️ Estado — Verificado Por Claude (Con Límites)

```
✅ Lógica del wire format verificada CONTRA:
   - El spec de Protocol Buffers de Google (150→089601, zigzag canónico)
   - La librería protobuf REAL de Python (byte-por-byte)
   - El wrapper TS completo (14 tests contra un mock funcional)
✅ Typecheck del wrapper TS limpio (strict + noUncheckedIndexedAccess)
✅ Biome limpio
✅ Los 3 YAML de CI/CD validados
```

## 🔴 Lo Que NO Pude Verificar (Importante)

**No puedo compilar Rust en mi entorno** (rustup bloqueado, como con
signalis-core). Entonces:

- ✅ Escribí todo el código Rust (core + binding NAPI) y **verifiqué su LÓGICA**
  replicándola en Python y probándola contra el protobuf real.
- ❌ **NO pude compilar el `.node`** ni correr `cargo test` ni los tests de
  vitest contra el binding real.

**Vos tenés que compilar y confirmar.** El código Rust puede tener errores de
sintaxis o de tipos de NAPI que yo no veo sin compilar. La lógica del algoritmo
está verificada; la compilación es tuya.

## 📦 Estructura

```
signalis-codec/
├── Cargo.toml                    workspace (2 crates)
├── crates/
│   ├── codec-core/               Rust puro, SIN unsafe, SIN deps
│   │   └── src/{reader,wire,decoder,encoder,error,lib}.rs
│   └── codec-node/               binding NAPI
│       ├── src/lib.rs
│       └── build.rs
├── src/index.ts                  wrapper TS tipado
├── __tests__/codec.test.ts       14 tests (contra el addon real)
├── .github/ (ci.yml, release.yml, dependabot.yml)
├── package.json (scripts NAPI: build:native, etc.)
└── docs: README EN/ES, CHANGELOG, ROADMAP, SECURITY, CONTRIBUTING, CODE_OF_CONDUCT
```

## 🚀 Compilar Y Probar (Tu Parte)

```powershell
cd F:\Brashkie\PROYECTOS\NPM
# Extraer signalis-codec.zip

cd signalis-codec
npm install

# 1. Primero: compilar el core Rust y correr sus tests
npm run test:rust
#    → cargo test del wire codec (varint, zigzag, depth limit, malformados)
#    Si algo falla acá, es un bug del Rust que yo no pude ver. Traémelo.

# 2. Compilar el binding NAPI
npm run build:native
#    → genera el .node + index.js + index.d.ts
#    Acá pueden salir errores de tipos de NAPI (BigInt, Buffer). Traémelos.

# 3. Compilar el TS
npm run build:ts

# 4. Correr los tests TS contra el binding REAL
npm test
#    → 14 tests. Estos prueban el codec de verdad, no un mock.

# 5. Lint + typecheck
npm run lint
npm run typecheck
```

## 🎯 El Diferencial De Este Paquete

**Seguridad anti-Proto6.** El CVE de recursión que encontramos (un payload de
34KB con 10.000 niveles crashea a Baileys) está mitigado en el core: `decodeTree`
tiene `maxDepth`, y superarlo lanza error en vez de desbordar el stack. Es lo que
hace a tu codec **más seguro** que protobufjs desde el día uno.

## ⏭️ Después: @brashkie/waproto

Con signalis-codec funcionando, waproto es: tomar el schema público de WhatsApp
(WPPConnect/wa-proto o Baileys) + mapear field numbers a nombres usando este
codec + agregar los límites de seguridad. El bloqueante (el motor Protobuf) ya
está resuelto.

## 🔑 Setup Para Publicar

1. Repo Public en github.com/Brashkie/signalis-codec
2. NPM_TOKEN (Automation) en Settings → Secrets → Actions
3. Con el CI verde: `git tag v0.1.0 && git push origin v0.1.0`
   → el release compila las plataformas y publica con provenance

---

🦀 + ❤️ Hepein Oficial
