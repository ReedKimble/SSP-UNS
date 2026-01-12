# UNS Model & Virtual Machine Implementation Plan

This document captures an actionable model and VM blueprint derived from `UNS_Module_9_Machine_First.md` and `UNS_Runtime32_Spec.*`. It is written to be consumption-ready for both humans and tooling.

---

## 1. Runtime Constants & Encodings

| Concept | Definition |
| --- | --- |
| `Word32` | signed 32-bit integer, two's complement |
| Fixed-point | Q16.16 (scale factor 65536) |
| `encodeReal(r)` | `Math.round(r * 65536)` |
| `decodeReal(w)` | `w / 65536` |
| Complex scalar | tuple `(real: Word32, imag: Word32)` |
| Microstates `M` | implementation parameter (default 8 in the SPA) |

Helper ops:

```text
addQ16(a,b) = (a + b)
subQ16(a,b) = (a - b)
mulQ16(a,b) = (a * b) >> 16
divQ16(a,b) = (a << 16) / b  (b != 0)
mag2(c) = mulQ16(c.real, c.real) + mulQ16(c.imag, c.imag)
```

---

## 2. Core Data Structures

```text
Complex32 = { real: Word32, imag: Word32 }
UValue32  = Complex32[M]
UState32  = Complex32[M]
ValueRef  = {
  kind: "scalar" | "uvalue" | "ustate" | "novel",
  payload: Complex32 | HeapId | NovelId
}
NovelEntry = { id, op, args, index }
Environment = Map<string, ValueRef>
```

Heap layout:

- `heap.values`: dense array of `UValue32`
- `heap.states`: dense array of `UState32`
- `heap.novels`: dictionary of `NovelEntry`

Allocation returns handles `HeapId = number`.

---

## 3. Instruction Set (stack-based)

| Opcode | Stack effect | Purpose |
| --- | --- | --- |
| `PUSH_SCALAR re im` | `[] -> [Scalar]` | Push complex scalar |
| `MAKE_CONST_UVALUE` | `[Scalar] -> [UValue]` | Fill microstates with scalar |
| `MAKE_STATE` | `[] -> [UState]` | Allocate default normalized state |
| `UVALUE_TO_STATE` | `[UValue] -> [UState]` | Copy amplitudes into state heap, then normalize |
| `LOAD name` | `[] -> [Value]` | Push env binding |
| `STORE name` | `[Value] -> []` | Bind env name |
| `UADD` | `[UValue,UValue] -> [UValue]` | +u |
| `UMUL` | `[UValue,UValue] -> [UValue]` | *u |
| `SSCALE` | `[Scalar,UValue] -> [UValue]` | *s (scalar first) |
| `LIFT1 func` | `[UValue] -> [UValue]` | lift unary function |
| `LIFT2 func` | `[UValue,UValue] -> [UValue]` | lift binary function |
| `READ` | `[UState,UValue] -> [Scalar]` | read(f | psi) |
| `NORM_STATE` | `[UState] -> [UState]` | normalize in-place |
| `D_TRANSFORM n` | `[UState] -> [UState]` | D(n, psi) |
| `HALT` | stop | end program |

Novel propagation occurs in `LIFT*` and `UMUL` when zero-divisions or undefined cases happen.

---

## 4. Compilation Pipeline

1. **Tokenizer** — produces tokens (keywords, identifiers, literals, operators).
2. **Parser** — builds AST with node kinds: `Program`, `LetDecl`, `StateDecl`, `Read`, `Lift1`, `Lift2`, `Const`, `Binary`, `DTransform`, `Identifier`, `ScalarLiteral`.
3. **Type tagging** — determines whether expressions produce scalars, values, or states (lightweight, heuristic-driven for the SPA).
4. **Instruction selection** — recursive descent emitting opcodes per AST pattern.
5. **VM Execution** — runs opcodes using the stack/heap/environment model above.

---

## 5. Normalization & Readout Algorithms

### Normalize State

```
normState(id):
  psi = heap.states[id]
  sum = 0
  for each c in psi:
    sum += mag2(c)
  if sum == 0: fill psi with uniform constant 1/M
  scale = invSqrt(sum)
  for each c in psi:
    c.real = mulQ16(c.real, scale)
    c.imag = mulQ16(c.imag, scale)
```

### Readout

```
read(uValId, stateId):
  f = heap.values[uValId]
  psi = heap.states[stateId]
  accReal = accImag = 0
  for i in 0..M-1:
    psi2 = mag2(psi[i])
    accReal += mulQ16(f[i].real, psi2)
    accImag += mulQ16(f[i].imag, psi2)
  return Complex32(accReal, accImag)
```

---

## 6. Lifting Hooks

Unary library provided in SPA:

- `sqrt`, `sin`, `cos`, `log`, `conj` (per microstate) with fallbacks to `Novel` when undefined.

Binary library:

- `divide`, `pow`, `max`, `min`, `phaseBlend` (demo), each returning `Novel` entries when inputs invalid.

Novel entries keep: `{ op, args: [Complex32…], index }`.

---

## 7. SPA Integration Summary

The single-page app wires the above model into an interactive surface:

1. Users edit UNS text.
2. Clicking **Compile & Run** drives tokenizer → parser → compiler → VM.
3. Execution artifacts feed UI panes:
   - Output scalar (`Complex32`, decoded to floats)
   - Expression tree (`JSON.stringify(AST)`).
   - Value tracker (environment table with handles & decoded samples).
   - Read tester (select `UValue` + `UState` to invoke VM `read`).
   - Debug log (token stream, emitted opcodes, vm trace).

The app also exposes `Sample Program` to demonstrate the workflow.

---

This blueprint is directly implemented in `uns_runtime_app.html` in this workspace.

---

## 8. UNS Operator Extensions (Spec + Library)

To keep the core UNS definition intact while providing a standard toolkit, the runtime now ships with two layers of operators:

### 8.1 Spec-Level Core Operators

1. `NORM(x)` – Normalizes any nonnegative vector to the simplex. When the sum of components is zero, it deterministically returns the uniform vector of matching dimension.
2. `MIX(u, v; α)` – Formalized convex mix, clamping `α ∈ [0,1]` and preserving the simplex invariant.
3. `MERGE({u^{(j)}}, {w_j})` – Weighted combination of UNS elements followed by `NORM`. Weights default to 1 and must be nonnegative.
4. `SPLIT(u; {α_j})` – Produces subnormalized components `α_j u` where the `α_j` form a simplex. Callers can re-normalize individual slices via `NORM` if a standalone UNS element is required.
5. `CANCEL(u, v)` plus optional `CANCEL_JOINT(u, v)` – Removes overlap via `OVERLAP`, renormalizes residuals with `NORM`, and keeps symmetry guarantees.

### 8.2 Helper Utilities

- `OVERLAP(u, v)` – Component-wise minima driving the cancellation process.
- `MASK(u; m)` and `PROJECT(u; S)` – Apply nonnegative masks (or subset indicators) followed by `NORM` with the same zero-sum fallback.
- `DOT(u, v)` and `DIST_L1(u, v)` – Read-only observables confined to `[0, 1]`; useful for steering higher-level algorithms without altering UNS data.

### 8.3 Validation & Testing

The SPA reference implementation includes automated checks that:

- Confirm nonnegativity and unit-sum invariants for every UNS-returning operator.
- Assert that `CANCEL` is symmetric (residuals swap when arguments swap).
- Bound the metrics (`DOT`, `DIST_L1`) inside `[0,1]` even under floating-point noise.

These additions keep the mathematical meaning of UNS untouched while standardizing the everyday manipulations engineers need when composing programs or debugging microstates.
