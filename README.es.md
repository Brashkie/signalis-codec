<div align="center">

# @brashkie/signalis-codec

**Un codec de wire de Protobuf, seguro y potenciado por Rust.**

[English](./README.md) · [Español](./README.es.md)

</div>

---

Un **wire codec de Protobuf (Nivel 1)**: lee y escribe los cuatro wire types de
Protocol Buffers (varint, fixed64, length-delimited, fixed32) con un core en Rust
estrictamente bounds-checked y **limitado en profundidad por diseño**. Es
agnóstico al schema — trabajás con números de campo y wire types, no con mensajes
con nombre.

Es la base de serialización para [`@brashkie/waproto`](https://github.com/Brashkie/waproto)
(el schema Protobuf de WhatsApp), pero sirve como primitiva de Protobuf autónoma
para cualquier protocolo binario.

## ¿Por qué otra librería de Protobuf?

La mayoría de las librerías de Protobuf en JS son JavaScript puro y no fueron
escritas pensando en input hostil como prioridad. El schema de WhatsApp es
profundamente recursivo, y un payload malicioso con decenas de miles de niveles
de anidamiento puede agotar el stack — una clase real de denegación de servicio
(los bugs "Proto6").

`signalis-codec` lo resuelve en el core:

- **Motor Rust** — velocidad nativa para parsing con muchos varints, seguro en
  memoria por construcción (`#![forbid(unsafe_code)]`).
- **Límite de profundidad** — el decode recursivo está acotado por un `maxDepth`
  explícito; superarlo lanza error en vez de desbordar el stack.
- **Bounds-checking estricto** — cada lectura valida el buffer primero.
- **Sin panics con input malo** — los payloads malformados siempre salen como
  errores atrapables.

## Instalación

```bash
npm install @brashkie/signalis-codec
```

Trae binarios nativos precompilados para las plataformas comunes.

### Plataformas soportadas

Los binarios precompilados vienen para:

| SO | Arquitectura |
|----|--------------|
| Linux | x64 (glibc) |
| macOS | x64 (Intel) · arm64 (Apple Silicon) |
| Windows | x64 |

En cualquier otra plataforma, la instalación no encuentra binario. Si necesitás
una que no está en la lista, abrí un issue — agregar un target es un cambio de
una línea en la matriz de build. (Para compilar desde el código necesitás Rust y
Node 18+.)

## Inicio rápido

```ts
import { encodeFields, decodeFields, WireType } from '@brashkie/signalis-codec';

const buf = encodeFields([
  { fieldNumber: 1, wireType: WireType.Varint, varint: 150n },
  { fieldNumber: 2, wireType: WireType.Bytes, bytes: Buffer.from('hola') },
]);

const fields = decodeFields(buf);
```

Los valores de 64 bits (varint, fixed64) se devuelven como `BigInt` para preservar
los 64 bits al pasar por JavaScript.

## Decode recursivo con límite de profundidad

```ts
import { decodeTree } from '@brashkie/signalis-codec';

const tree = decodeTree(buf, 100); // maxDepth = 100 (default)

// Un payload malicioso de 10.000 niveles lanza error en vez de crashear:
decodeTree(evilBuf, 100); // → Error: nesting depth exceeded limit of 100
```

## Helpers de tipos lógicos

El wire codec es agnóstico al schema: un varint es solo un varint. El tipo
*lógico* (int32 vs sint32 vs bool vs enum…) vive en el schema, así que decodificar
devuelve valores crudos y un conjunto de helpers los interpreta. Los `as*`
(lectura) y `from*` (escritura) son perfectamente simétricos, y cada `from*`
valida el rango — pasar un valor fuera de rango lanza `RangeError` en vez de
truncar en silencio.

```ts
import {
  encodeFields, decodeFields, WireType,
  asUint32, asString, fromUint32, fromString,
} from '@brashkie/signalis-codec';

// Para un schema como:  message Device { uint32 id = 1; string name = 2; }

const buf = encodeFields([
  { fieldNumber: 1, wireType: WireType.Varint, varint: fromUint32(150) },
  { fieldNumber: 2, wireType: WireType.Bytes,  bytes:  fromString('phone') },
]);

const f = decodeFields(buf);
const device = { id: asUint32(f[0].varint), name: asString(f[1].bytes) };
// → { id: 150, name: 'phone' }
```

Los casos difíciles (int32 negativo como varint de 10 bytes, ZigZag para `sint*`,
IEEE-754 para `float`/`double`) están manejados y verificados contra el protobuf
de referencia.

## Qué es (y qué no)

- ✅ Un **wire codec** — la capa a nivel de bytes de Protobuf.
- ❌ No es un **compilador de schemas** — no lee archivos `.proto` ni genera
  clases tipadas. Eso es una capa superior (ej: `@brashkie/waproto`).

## Licencia

Apache-2.0 © Brashkie (Hepein Oficial)
