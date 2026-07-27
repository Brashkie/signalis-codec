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

## Qué es (y qué no)

- ✅ Un **wire codec** — la capa a nivel de bytes de Protobuf.
- ❌ No es un **compilador de schemas** — no lee archivos `.proto` ni genera
  clases tipadas. Eso es una capa superior (ej: `@brashkie/waproto`).

## Licencia

Apache-2.0 © Brashkie (Hepein Oficial)
