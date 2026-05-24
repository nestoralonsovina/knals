# Quarkus + GraalVM native image for the backend

The backend uses Quarkus with the fabric8 kubernetes-client, compiled to a native binary via GraalVM. Alternatives considered were Rust (axum + kube-rs) and Spring Boot + GraalVM.

Quarkus was chosen over Rust because the developer is unfamiliar with Rust and wants to control at least one technology in the stack (OpenTUI is also new). Quarkus was chosen over Spring Boot because it was designed for native-image from the start: smaller binaries (~30-60 MB vs ~60-120 MB), fewer reflection configuration issues, a first-class `quarkus-kubernetes-client` extension with native-image support pre-configured, and Mutiny reactive streams as a natural fit for Kubernetes watch/SSE patterns.

## Consequences

- JAX-RS instead of Spring MVC annotations.
- CDI instead of Spring DI.
- Mutiny `Multi`/`Uni` instead of Reactor `Flux`/`Mono` for SSE streams.
- SmallRye OpenAPI for spec generation instead of springdoc.
- Dev loop via `quarkus:dev` with live reload.
