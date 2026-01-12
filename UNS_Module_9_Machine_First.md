
# Universal Numer Set (UNS) — Runtime, Lexicon & VM Model (Machine-First Specification)

This document is a **machine-first** specification of the UNS runtime and language model.  
It is intended for:

- parser and interpreter authors,  
- virtual machine designers,  
- and LLMs that need a precise, structured understanding of UNS expressions.

It unifies:

- the UNS core language syntax,  
- the `UNS_Runtime32_Spec` execution model,  
- a keyword / token lexicon,  
- and a simple virtual machine (VM) instruction set.

The goal is that a machine reading this document can:

1. Tokenize and parse UNS source text,  
2. Build a normalized abstract syntax tree (AST),  
3. Map AST nodes onto UNS_Runtime32 data structures,  
4. Execute UNS programs using a 32-bit, fixed-point VM.

---

## 0. UNS Core Definition and Operator Bundle

### 0.1 Preserved Simplex Definition

- A UNS element is a vector `u = (u_1, ..., u_n)` with `u_i >= 0` and `sum_i u_i = 1`.
- The canonical operation is the convex mix `mix(u, v; alpha) = alpha u + (1 - alpha) v` with `alpha` clamped to `[0, 1]` so the result stays in the simplex.

No additions in this document alter that foundation.

### 0.2 Spec-Level Operators

The standard runtime ships with the following operators that produce UNS elements (or subnormalized components) while preserving the simplex constraint:

| Operator | Signature | Notes |
| --- | --- | --- |
| `NORM(x)` | Nonnegative vector -> UNS | Divides by the component sum; if the sum is zero, returns the uniform vector of the same dimension. |
| `MIX(u, v; alpha)` | `UNS x UNS x [0,1] -> UNS` | Formalizes convex mixing; `alpha` is clamped for safety. |
| `MERGE({u^(j)}, {w_j})` | Finite UNS family + nonnegative weights -> UNS | Uses nonnegative accumulation followed by `NORM`; weights default to 1. |
| `SPLIT(u; {alpha_j})` | `UNS x` simplex of coefficients -> subnormalized slices | Results `u^(j) = alpha_j u` preserve nonnegativity; callers normalize if a standalone UNS element is required. |
| `CANCEL(u, v)` | `UNS x UNS -> (UNS, UNS)` | Removes the shared overlap `w_i = min(u_i, v_i)`, renormalizes residual components with `NORM`, and falls back to the uniform vector on zero sum. |
| `CANCEL_JOINT(u, v)` | `UNS x UNS -> UNS` | Optional joint form; normalizes `(u - w) + (v - w)` so it captures the combined non-overlap. |

### 0.3 Helper Utilities (Library Level)

Helpers are built on top of the spec-level operators and exposed in the SPA runtime:

- `OVERLAP(u, v)` – component-wise minima used inside `CANCEL`.
- `MASK(u; m)` – multiplies by a nonnegative mask and renormalizes (uniform fallback).
- `PROJECT(u; S)` – specialization of `MASK` with indicator mask for subset `S`.
- `DOT(u, v)` – read-only similarity `sum_i u_i v_i` within `[0, 1]`.
- `DIST_L1(u, v)` – read-only distance `(1/2) sum_i |u_i - v_i|` within `[0, 1]`.

### 0.4 Validation Requirements

Implementations must enforce:

1. Arguments are nonnegative and dimensionally matched.
2. Every UNS-returning operator yields components that sum to `1` within a small epsilon, resorting to the uniform fallback when the sum is zero.
3. `CANCEL` behaves symmetrically (swapping inputs swaps the outputs).
4. Metric helpers remain in `[0, 1]` despite floating-point noise.

The SPA reference implementation (see `uns_runtime_app.html`) runs automated self-tests at load time and exposes both the operator API and the test report for inspection.

---

## 1. Lexical Model

### 1.1 Character Set

Source files are UTF‑8 text.  
Identifiers and keywords use ASCII letters, digits, and `_`.

### 1.2 Tokens

The language is tokenized into the following categories:

#### 1.2.1 Keywords

These are reserved words and **must not** be used as identifiers:

- `let`
- `state`
- `const`
- `read`
- `lift1`
- `lift2`
- `D`
- `true`
- `false`

Optionally reserved (for future extension):

- `novel`
- `uvalue`
- `ustate`
- `scalar`
- `fn`
- `type`

#### 1.2.2 Operators

Multi-character operators have priority in tokenization.

- `+u`   — universal addition  
- `*u`   — universal multiplication  
- `*s`   — scalar scaling  
- `=`    — assignment  
- `|`    — readout separator (in `read(f | ψ)`)  
- `,`    — argument separator  
- `(` `)` — grouping and call parentheses

Note: `+` and `*` *alone* are not used in UNS; only `+u`, `*u`, `*s`.

#### 1.2.3 Literals

- **Integer literal**:  
  - regex: `[0-9]+`  
  - examples: `0`, `3`, `42`

- **Float literal**:  
  - regex: `[0-9]+\.[0-9]+`  
  - examples: `3.14`, `0.5`, `10.0`

- **Complex literal (optional)**:  
  - textual form: `<real>+<imag>i` or `<real>-<imag>i`  
  - examples: `3+4i`, `-2.5+0.75i`

- **Boolean literal**:  
  - `true`, `false`

#### 1.2.4 Identifiers

- regex: `[A-Za-z_][A-Za-z0-9_]*`  
- cannot match keyword set

#### 1.2.5 Comments

- Line comment: `//` to end-of-line  
- Block comment (optional): `/* ... */`

#### 1.2.6 Whitespace

- space, tab, newline, carriage return  
- ignored except as token separator

---

## 2. Abstract Syntax (AST)

### 2.1 Program Structure

A **program** is a sequence of declarations and/or expressions:

```ebnf
program       ::= { decl | expr } ;
```

### 2.2 Declarations

```ebnf
decl          ::= let-decl | state-decl ;

let-decl      ::= "let" identifier "=" expr ;
state-decl    ::= "state" identifier "=" expr ;
```

- `let` declares a value binding (expected to be a `UValue` or `Scalar`).
- `state` declares a state binding (expected to yield a `UState` after normalization).

### 2.3 Expressions

```ebnf
expr          ::= read-expr
                | lift1-expr
                | lift2-expr
                | const-expr
                | d-expr
                | binary-expr
                | primary ;

read-expr     ::= "read" "(" expr "|" expr ")" ;

lift1-expr    ::= "lift1" "(" identifier "," expr ")" ;

lift2-expr    ::= "lift2" "(" identifier "," expr "," expr ")" ;

const-expr    ::= "const" "(" scalar-literal ")" ;

d-expr        ::= "D" "(" integer-literal "," expr ")" ;

binary-expr   ::= expr binary-op expr ;

binary-op     ::= "+u" | "*u" | "*s" ;

primary       ::= identifier
                | scalar-literal
                | "(" expr ")" ;
```

### 2.4 AST Node Types (Canonical)

Recommended minimal AST node kinds:

- `Program`  
  - children: `[DeclOrExpr*]`

- `LetDecl`  
  - fields: `name: Identifier`, `value: Expr`

- `StateDecl`  
  - fields: `name: Identifier`, `value: Expr`

- `Read`  
  - fields: `value: Expr`, `state: Expr`

- `Lift1`  
  - fields: `funcName: Identifier`, `arg: Expr`

- `Lift2`  
  - fields: `funcName: Identifier`, `left: Expr`, `right: Expr`

- `Const`  
  - fields: `scalar: ScalarLiteral`

- `DTransform`  
  - fields: `dimension: IntegerLiteral`, `stateExpr: Expr`

- `Binary`  
  - fields: `op: ("+u" | "*u" | "*s")`, `left: Expr`, `right: Expr`

- `Identifier`  
  - fields: `name: String`

- `ScalarLiteral`  
  - fields: `re: float`, `im: float` (im = 0.0 for non-complex)

---

## 3. Mapping to `UNS_Runtime32_Spec`

This section maps AST node semantics onto the 32-bit runtime model.

### 3.1 Scalar Representation

At runtime, a scalar literal is mapped to:

- `Complex32` where:
  - `realPart = encodeReal(re)`
  - `imagPart = encodeReal(im)`

using Q16.16 as described in `UNS_Runtime32_Spec`:

```text
encodeReal(r) = round(r * 65536)
decodeReal(w) = w / 65536
```

### 3.2 UValue and UState Representation

At runtime:

- `UValue32 = array[0..M-1] of Complex32`
- `UState32 = array[0..M-1] of Complex32` (subject to normalization)

M is the chosen microstate count for the implementation.

### 3.3 Semantics of Core AST Nodes

#### 3.3.1 `Const`

AST:

```text
Const(scalar)
```

Runtime:

- produce a `UValue32` where:
  - for all i in `0..M-1`: `u[i] = encodeComplex(scalar)`

#### 3.3.2 `Binary` with `+u`

AST:

```text
Binary("+u", left, right)
```

Runtime:

- evaluate `left`, `right` → `UValue32 L, R`
- for i in `0..M-1`:
  - `out[i].real = addQ16(L[i].real, R[i].real)`
  - `out[i].imag = addQ16(L[i].imag, R[i].imag)`

#### 3.3.3 `Binary` with `*u`

AST:

```text
Binary("*u", left, right)
```

Runtime:

- evaluate `left`, `right` → `L, R` (`UValue32`)
- complex multiply at each microstate using Q16.16:

```text
real = mulQ16(L[i].real, R[i].real) - mulQ16(L[i].imag, R[i].imag)
imag = mulQ16(L[i].real, R[i].imag) + mulQ16(L[i].imag, R[i].real)
```

#### 3.3.4 `Binary` with `*s`

AST:

```text
Binary("*s", left, right)
```

Semantics:

- exactly one operand must be `Scalar` (or `Const` of scalar);
- the other must be a `UValue`.

Runtime:

- evaluate scalar → `Complex32 S`
- evaluate UValue → `UValue32 U`
- element-wise complex scaling.

#### 3.3.5 `Lift1`

AST:

```text
Lift1(funcName, arg)
```

Runtime:

- resolve `funcName` to a scalar operator `h32 : Complex32 → (Complex32 or Novel)`
  - e.g. `sqrt`, `sin`, `log`
- evaluate `arg` → `UValue32 A`
- for each index i, compute `A'[i] = h32(A[i])` (with novel handling)

#### 3.3.6 `Lift2`

AST:

```text
Lift2(funcName, left, right)
```

Runtime:

- resolve `funcName` to binary `k32 : (Complex32, Complex32) → (Complex32 or Novel)`
  - e.g. `divide`, `pow`
- evaluate `left`, `right` → `UValue32 L, R`
- for each i, compute `Out[i] = k32(L[i], R[i])`

#### 3.3.7 `Read`

AST:

```text
Read(valueExpr, stateExpr)
```

Runtime:

- evaluate `valueExpr` → `UValue32 F`
- evaluate `stateExpr` → `UState32 Psi`
- ensure Psi is normalized (enforcing norm ≈ 1)
- compute:

```text
accReal = 0
accImag = 0
for i in 0..M-1:
    psi2 = |Psi[i]|^2 (fixed-point)
    accReal += mulQ16(F[i].real, psi2)
    accImag += mulQ16(F[i].imag, psi2)
return Complex32(accReal, accImag)
```

Result is a **scalar** (Complex32).

#### 3.3.8 `DTransform`

AST:

```text
DTransform(N, stateExpr)
```

Runtime:

- evaluate `stateExpr` → `UState32 Psi`
- reshape / reindex Psi into new representation (implementation-defined mapping)
- re-normalize to ensure norm ≈ 1
- return new `UState32`.

### 3.4 Simplex Operators & Helpers

The operators enumerated in Section 0 map onto runtime arrays as follows:

- `NORM(x)` operates on any nonnegative numeric array, dividing by its sum or emitting the uniform vector if the sum is zero. The SPA runtime exposes it via `UNSOperators.NORM` and uses the same logic for state normalization fallbacks.
- `MIX(u, v; alpha)` shares the same representation as `+u`/`*s` composites but enforces scalar clamping and guarantees simplex invariants.
- `MERGE` and `SPLIT` are purely host-side utilities and do not introduce new opcodes; they are implemented as array transforms and, when needed, feed their results back into VM heap slots as freshly allocated `UValue` arrays.
- `CANCEL`/`CANCEL_JOINT` apply `OVERLAP`, residual subtraction, and `NORM` before values are reinserted into the environment. Residuals that sum to zero use the uniform fallback so downstream `read` or diagnostics remain well-defined.
- `MASK`/`PROJECT` are helper-layer functions that ultimately call `NORM` to keep outputs in the simplex.
- `DOT` and `DIST_L1` remain read-only scalars and therefore never push heap data; they are suitable for control-flow heuristics (deciding to merge, cancel, etc.) without mutating UNS elements.

Implementers embedding these helpers in other runtimes should mirror the validation guarantees described earlier (nonnegativity checks, epsilon-safe sum comparisons, symmetry for `CANCEL`, metric bounds).

---

## 4. VM Model

This section defines a simple stack-based VM to execute UNS programs.

### 4.1 Core Concepts

- **Data stack** for runtime values:
  - `SCALAR` (Complex32)
  - `UVALUE` (handle to `UValue32`)
  - `USTATE` (handle to `UState32`)
- **Environment / symbol table** mapping identifiers to runtime slots.
- **Heap** for:
  - arrays (`UValue32`, `UState32`)
  - novel value metadata.

### 4.2 VM Value Kinds

Define a tagged union:

```text
Value =
    Scalar(Complex32)
  | UValueRef(HeapId)
  | UStateRef(HeapId)
  | NovelRef(NovelId)
```

### 4.3 Suggested Instruction Set

Below is a minimal opcode set for UNS:

- `PUSH_SCALAR re, im`  
  - push a scalar Complex32 onto stack.

- `MAKE_CONST_UVALUE`  
  - pop Scalar → allocate UValue32 constant, push UValueRef.

- `LOAD name`  
  - push value bound to `name`.

- `STORE name`  
  - pop value, bind to `name` in environment.

- `UADD`  
  - pop UValueRef B, pop UValueRef A → compute A +u B → push result UValueRef.

- `UMUL`  
  - pop UValueRef B, pop UValueRef A → compute A *u B → push result.

- `SSCALE`  
  - pop UValueRef U, pop Scalar S → compute S *s U → push result.

- `LIFT1 funcId`  
  - pop UValueRef U → apply unary lift → push UValueRef.

- `LIFT2 funcId`  
  - pop UValueRef V, pop UValueRef U → apply binary lift → push UValueRef.

- `READ`  
  - pop UStateRef Psi, pop UValueRef F → compute read(F | Psi) → push Scalar.

- `MAKE_STATE`  
  - implementation-specific: create a default or explicit UState32.

- `NORM_STATE`  
  - pop UStateRef Psi → normalize in-place → push same ref.

- `D_TRANSFORM N`  
  - pop UStateRef Psi → apply D(N, Psi) → push new UStateRef.

- `HALT`  
  - stop execution.

### 4.4 Compilation Strategy (Source → VM)

Typical compilation of:

```text
let A = const(3)
let B = const(4)
let S = A *u A +u B *u B
let H = lift1(sqrt, S)
read(H | ψ)
```

into VM bytecode (one possible scheme):

1. `PUSH_SCALAR 3.0, 0.0`  
2. `MAKE_CONST_UVALUE`  
3. `STORE "A"`

4. `PUSH_SCALAR 4.0, 0.0`  
5. `MAKE_CONST_UVALUE`  
6. `STORE "B"`

7. `LOAD "A"`  
8. `LOAD "A"`  
9. `UMUL`                         ; A*A  
10. `LOAD "B"`  
11. `LOAD "B"`  
12. `UMUL`                         ; B*B  
13. `UADD`                         ; (A*A) +u (B*B)  
14. `STORE "S"`

15. `LOAD "S"`  
16. `LIFT1 sqrt`                  ; sqrtU(S)  
17. `STORE "H"`

18. `LOAD "H"`  
19. `LOAD "ψ"`                    ; assume ψ declared elsewhere  
20. `READ`                        ; result on stack  
21. `HALT`

### 4.5 Novel Value Handling in VM

Whenever a lifted operator or binary operation encounters an undefined case:

- VM allocates a `NovelEntry` in NovelTable:
  - `id = nextNovelId`
  - `op = funcId`
  - `args = scalar inputs at that microstate`
  - `index = microstate index`
- The affected element in `UValue32` is stored with a special sentinel or associated NovelId.
- VM operations that encounter such elements propagate novel status as required.

VM must ensure:

- Novel values are never treated as scalars,
- Readout computations ignore or incorporate them according to ψ (if ψ(x)=0, they do not affect result),
- Novel provenance remains available.

---

## 5. Summary for Machines / LLMs

To correctly parse and execute UNS:

1. **Tokenization**  
   - recognize keywords (`let`, `state`, `const`, `read`, `lift1`, `lift2`, `D`), operators (`+u`, `*u`, `*s`, `=`, `|`, `,`, `(`, `)`), identifiers, numeric literals.

2. **Parsing**  
   - build AST with node kinds `Program`, `LetDecl`, `StateDecl`, `Read`, `Lift1`, `Lift2`, `Const`, `DTransform`, `Binary`, `Identifier`, `ScalarLiteral`.

3. **Type & Semantic Checking**  
   - ensure correct use of `*s`, `read`, `state`, etc. (see Module 5).

4. **Compilation**  
   - map AST nodes into VM bytecode that operates on:
     - `Word32`,
     - `Complex32`,
     - `UValue32`,
     - `UState32`.

5. **Execution**  
   - implement:
     - fixed-point arithmetic (Q16.16),
     - universal operations (+u, *u),
     - lifting (lift1, lift2),
     - readout,
     - dimensional transform `D`,
     - novel value creation and tracking.

This specification is sufficient for a machine or LLM to construct:

- a full tokenizer,  
- a parser,  
- a semantic analyzer,  
- and a working virtual machine for UNS programs.

