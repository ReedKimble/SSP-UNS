
# Universal Number Set (UNS) Runtime Model — 32‑bit Core Backend

This document describes a **foundationally pure**, **implementation‑oriented** model for executing UNS programs using only **signed 32‑bit integers** as the primitive machine type.  
It is designed so that *any* platform or language can implement a UNS interpreter or runtime using this description alone.

---

## 0. Core UNS Definition (Preserved)

The foundational definition of a UNS element remains unchanged and anchors every extension below:

- **UNS simplex**: a vector `u = (u₁, …, uₙ)` with `uᵢ ≥ 0` and `∑ᵢ uᵢ = 1`.
- **Convex mix**: `mix(u, v; α) = αu + (1 − α)v` for `α ∈ [0, 1]`, with the result required to satisfy the simplex constraints.

All new operators respect this baseline; none alter the mathematical meaning of UNS elements.

---

## 1. Layered Architecture

We distinguish three layers:

1. **Abstract UNS Math Layer**  
   - As previously defined: `U = (X, μ)`, `UValue`, `UState`, `read`, `lift1`, `lift2`, `novel`, etc.

2. **UNS Core Language Layer**  
   - The concrete syntax and typing: `+u`, `*u`, `*s`, `read(f | psi)`, `D(N, psi)`, `sqrtU`, `divideU`, etc.

3. **UNS 32‑bit Runtime Layer (this document)**  
   - How to represent UNS values using *only* signed 32‑bit integers.
   - How to execute the core operations purely in integer arithmetic.
   - How to encode/decode abstract scalars into 32‑bit words.

The **abstract layer** remains mathematically unconstrained (complex‑valued, continuous, etc.), while the **runtime layer** provides a *finite, computable approximation* using integers.

---

## 2. 32‑bit Scalar Representation

### 2.1 Primitive Word Type

All low‑level values are represented using a single primitive type:

```text
Word32  = signed 32‑bit integer  (two's complement)
range   = [−2^31, 2^31 − 1]
```

This is assumed to be available on all platforms (or emulable).

### 2.2 Fixed‑Point Encoding (Q16.16)

To approximate real (and complex) scalars, we use **Q16.16 fixed‑point**:

- Upper 16 bits: signed integer part  
- Lower 16 bits: fractional part  
- Scaling factor: `S = 2^16 = 65536`

#### Encoding real scalars

```text
encodeReal(r) : ℝ -> Word32
encodeReal(r) = round(r * S)
```

#### Decoding real scalars

```text
decodeReal(w) : Word32 -> ℝ
decodeReal(w) = w / S
```

#### Integer arithmetic rules

- Addition:
  ```text
  addQ16(a, b) = a + b           -- with wrap or saturation (implementation choice)
  ```
- Subtraction:
  ```text
  subQ16(a, b) = a - b
  ```
- Multiplication:
  ```text
  mulQ16(a, b) = (a * b) >> 16   -- arithmetic right shift, keeping Q16.16 scale
  ```
- Division (non‑zero denominator):
  ```text
  divQ16(a, b) = (a << 16) / b   -- integer division, handling sign
  ```

### 2.3 Complex Scalars in Q16.16

A complex scalar is represented as a pair:

```text
Complex32 = (Word32 realPart, Word32 imagPart)
```

Encoding:
```text
encodeComplex(r + i·c) = (encodeReal(r), encodeReal(c))
```

Arithmetic is performed component‑wise (with complex multiplication rules when needed).

---

## 3. Representation of UNS Concepts in 32‑bit Terms

### 3.1 Microstate Index Space

In the runtime, we represent the (potentially abstract) microstate space `X` by a **finite index set**:

```text
X_runtime = { 0, 1, 2, ..., M − 1 }
where M is a positive integer (implementation parameter)
```

Each index corresponds to a “microstate slot” where values live.

### 3.2 UValue as Arrays of 32‑bit Encodings

At runtime, a `UValue` is represented as:

```text
UValue32 = array[0..M−1] of Complex32
```

That is: for each microstate index `i`, we store one complex fixed‑point value.

### 3.3 UState as Arrays of 32‑bit Encodings

A `UState` is also an array of Complex32, interpreted as `psi(i)` values, with a separate **normalization procedure** enforcing:

```text
norm(psi) ≈ 1
```

Runtime normalization algorithm:

```text
norm2 = sum over i ( |psi(i)|^2 )   -- magnitude squared in Q16.16 (real) or Q32.32 internally
scale = 1 / sqrt(norm2)            -- computed using integer sqrt
psi'(i) = psi(i) * scale
```

Normalization may be approximated; exactness is not required by the runtime, only convergence.

---

## 4. Core UNS Operations in 32‑bit Terms

Below, all operations are defined component‑wise for each microstate index `i`.

### 4.1 Universal Addition `+u`

Abstract:
```text
(f +u g)(x) = f(x) + g(x)
```

Runtime:
```text
for i in 0..M−1:
    out[i].real = addQ16(f[i].real, g[i].real)
    out[i].imag = addQ16(f[i].imag, g[i].imag)
```

### 4.2 Universal Product `*u`

Abstract:
```text
(f *u g)(x) = f(x) * g(x)
```

Runtime (complex multiplication in Q16.16):

```text
for i in 0..M−1:
    a = f[i]; b = g[i]
    real = mulQ16(a.real, b.real) - mulQ16(a.imag, b.imag)
    imag = mulQ16(a.real, b.imag) + mulQ16(a.imag, b.real)
    out[i] = (real, imag)
```

### 4.3 Scalar Scaling `*s`

Abstract:
```text
(a *s f)(x) = a * f(x)
```

Runtime:

```text
for i in 0..M−1:
    out[i].real = mulQ16(a.real, f[i].real) - mulQ16(a.imag, f[i].imag)
    out[i].imag = mulQ16(a.real, f[i].imag) + mulQ16(a.imag, f[i].real)
```

(If `a` is purely real, its imagPart is 0.)

### 4.4 Constant Embedding `const(a)`

Abstract:
```text
const(a)(x) = a
```

Runtime:

```text
for i in 0..M−1:
    out[i] = encodeComplex(a)
```

---

## 5. Readout in 32‑bit Terms

Abstract readout:
```text
read(f | psi) = ∫ f(x) * |psi(x)|^2 dμ
```

Runtime approximation as a finite sum:

```text
read32(f, psi):
    accReal = 0
    accImag = 0      -- usually 0 if f is real-valued

    for i in 0..M−1:
        psi2 = |psi[i]|^2     -- magnitude squared in Q16.16 (real only)
        termReal = mulQ16(f[i].real, psi2)
        termImag = mulQ16(f[i].imag, psi2)
        accReal = addQ16(accReal, termReal)
        accImag = addQ16(accImag, termImag)

    return (accReal, accImag)  -- Complex32 result
```

In many use cases, `f` will be real‑valued, so `accImag` will remain zero.

---

## 6. Lifted Functions in 32‑bit Terms

### 6.1 Unary Lift: `lift1`

Abstract:
```text
lift1(f)(u)(x) = f(u(x))
```

Runtime:
- `f` is implemented as a function on `Complex32` (or `Word32` if restricted to real):
  ```text
  f32 : Complex32 -> Complex32 or Word32 -> Word32
  ```

Then:

```text
lift1_32(f32, u):
    out = new UValue32
    for i in 0..M−1:
        out[i] = f32(u[i])
    return out
```

Example: `sqrtU`

- `sqrtU = lift1(sqrt)`  
- Runtime `sqrt32` implementation can:
  - perform a complex square root in Q16.16, or  
  - for purely real positive inputs, perform a Q16.16 integer sqrt, and  
  - for negative inputs, return complex results.

### 6.2 Binary Lift: `lift2`

Abstract:
```text
lift2(g)(u,v)(x) = g(u(x), v(x))
```

Runtime:
- `g` is implemented as:
  ```text
  g32 : (Complex32, Complex32) -> Complex32 or Novel
  ```

Then:

```text
lift2_32(g32, u, v):
    out = new UValue32 (or mixed: UValue32 + NovelMap)
    for i in 0..M−1:
        out[i] = g32(u[i], v[i])
    return out
```

Example: `divideU = lift2(divide)`

- If `v[i]` represents zero (both real and imag near 0), `g32` returns a **novel value token** instead of a numeric `Complex32`.

---

## 7. Novel Values at Runtime

Novel values like:

```text
novel("divide", (a, 0), x_i)
```

need a concrete representation.

We propose:

```text
NovelId = 32‑bit integer handle
NovelEntry = {
    id: NovelId,
    op: string,
    args: list of Complex32,
    index: int (microstate index)
}
```

A runtime maintains:

```text
NovelTable = map[NovelId] -> NovelEntry
```

And encoded `UValue32` arrays can store a special sentinel (e.g., reserved extreme values) plus an associated `NovelId` side table, or store only numeric values while maintaining a parallel “novel mask.”

The exact storage strategy is implementation‑specific; the requirement is:

> **Every novel value must be uniquely identifiable and traceable back to `(op, args, index)`**.

---

## 8. Dimensional Transforms in 32‑bit Terms

Abstract:
```text
D(N, psi) : redistributes psi into an N‑dimensional representation preserving norm.
```

Runtime (one simple pattern):

- Treat `psi` as a vector of length `M`.  
- To construct an `N`‑dimensional representation `psiN`, define a mapping:

  ```text
  i in [0..M−1] <-> (d1, d2, ..., dN)  (indexing into an N‑D grid)
  ```

  and then:

  ```text
  psiN[d1,...,dN] = psi[i]
  ```

- Normalization can then be enforced again if necessary.

The exact indexing layout is left to the implementation; the **semantic constraint** is:

```text
norm(psiN) ≈ norm(psi) ≈ 1
```

---

## 9. JSON Model Export (High‑level Overview)

Alongside this Markdown, a JSON file can describe:

- primitive types (`Word32`, `Complex32`, `UValue32`, `UState32`)
- operations (`addQ16`, `mulQ16`, `divQ16`, `sqrt32`, `lift1_32`, `lift2_32`)
- normalization procedure
- novel value mechanics
- dimensional transform semantics

---

## 10. Implementation Notes

- **Foundational purity**:  
  All core math uses integer operations only (add, sub, mul, div, shift).  
  Any floating‑point usage is an optional optimization, not a requirement.

- **Portability**:  
  The spec assumes only 32‑bit signed integer support and basic memory arrays.

- **Precision**:  
  Q16.16 can be replaced by Qx.y variants if higher dynamic range or precision is needed, but Q16.16 is the **baseline** for shared implementations.

- **Performance**:  
  Implementations are free to:
  - vectorize array operations  
  - use native complex types or floats internally  
  - cache normalization factors  
  so long as their behavior agrees with the integer‑defined semantics to within acceptable approximation.

---

## 11. UNS Operator Extensions

This section standardizes a portable bundle of operators built **on top of** the preserved core definition. We distinguish **spec-level core operators** (mandatory semantics) and **helper utilities** (library conveniences). Unless stated otherwise, inputs are UNS elements and outputs must remain in the simplex, with tolerances accommodating floating-point rounding.

### 11.1 Spec-Level Core Operators

| Operator | Signature | Invariants |
| --- | --- | --- |
| `NORM(x)` | Nonnegative vector → UNS element | Let `S = ∑ᵢ xᵢ`. If `S > 0`, return `x / S`. If `S = 0`, return the uniform vector `(1/n, …, 1/n)` of matching dimension. Input components must satisfy `xᵢ ≥ 0`.
| `MIX(u, v; α)` | `UNS × UNS × [0,1] → UNS` | Returns `αu + (1−α)v` with α‑clamped to `[0,1]`. Convexity preserves nonnegativity and unit sum by construction.
| `MERGE({u^{(j)}}, {w_j})` | Finite UNS family + optional nonnegative weights → UNS | Compute `x = ∑_j w_j u^{(j)}` where `w_j` defaults to `1`. Require `w_j ≥ 0` and at least one positive weight. Return `NORM(x)`.
| `SPLIT(u; {α_j})` | `UNS ×` nonnegative coefficients summing to `1` → sub-UNS components | Produce `u^{(j)} = α_j u`. The components are nonnegative and sum to `α_j`; they are **subnormalized** by design. Consumers may call `NORM(u^{(j)})` if standalone UNS elements are desired.
| `CANCEL(u, v)` | `UNS × UNS → (u', v')` | Define `w = OVERLAP(u, v)` with `wᵢ = min(uᵢ, vᵢ)`. Residuals `u_raw = u − w` and `v_raw = v − w` are nonnegative. Apply `NORM` to each non-zero residual; if a residual sums to `0`, fall back to the uniform vector of the same dimension. Outputs capture the non-overlapping portions while preserving symmetry.
| `CANCEL_JOINT(u, v)` | `UNS × UNS → UNS` | Optional joint form. Let `w` be as above, `r = (u − w) + (v − w)`. Return `NORM(r)` when `∑ rᵢ > 0`, otherwise the uniform vector. Encodes combined non-overlap as a single UNS element.

### 11.2 Helper Utilities (Library-Level)

| Helper | Signature | Purpose |
| --- | --- | --- |
| `OVERLAP(u, v)` | `UNS × UNS →` nonnegative vector | Component-wise minimum used by `CANCEL`. Does **not** renormalize.
| `MASK(u; m)` | `UNS ×` nonnegative mask → UNS | Forms `xᵢ = mᵢ uᵢ`, then returns `NORM(x)` (uniform fallback on zero sum). Masks may attenuate or zero components.
| `PROJECT(u; S)` | `UNS ×` index subset → UNS | Special case of `MASK` where `mᵢ = 1` if `i ∈ S`, else `0`.
| `DOT(u, v)` | `UNS × UNS → [0,1]` scalar | Computes `∑ᵢ uᵢ vᵢ`. Values lie within `[0,1]` by simplex constraints. Read-only observable.
| `DIST_L1(u, v)` | `UNS × UNS → [0,1]` scalar | Returns `(1/2)∑ᵢ |uᵢ − vᵢ|`. Measures simplex distance; also read-only.

### 11.3 Validation Requirements

Implementations must:

1. Reject negative components and mismatched dimensions during argument validation.
2. Guarantee that every UNS-returning operator produces nonnegative components whose sums equal `1` within a small tolerance (e.g., `1e−9`).
3. Treat the `S = 0` cases of `NORM`, `CANCEL`, `MASK`, and `MERGE` using the uniform fallback to keep semantics deterministic.
4. Provide regression tests covering:
   - Nonnegativity preservation.
   - Sum-to-1 invariants.
   - Symmetry of `CANCEL` (the overlap removal is order-agnostic).
   - Metric bounds `0 ≤ DOT(u, v) ≤ 1` and `0 ≤ DIST_L1(u, v) ≤ 1`.

The helper utilities should be implemented on top of the spec-level operators wherever possible (e.g., `PROJECT` is `MASK` with a binary mask, `CANCEL` uses `OVERLAP` + `NORM`).

> **Note**: These extensions remain domain-agnostic and purely algebraic; they merely codify common workflows for manipulating UNS elements without changing the meaning of the underlying simplex.

This completes the **32‑bit core backend specification** for UNS.
