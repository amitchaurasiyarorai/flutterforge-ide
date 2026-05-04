package com.flutterforge.codegen.service;

import com.flutterforge.model.GenerationResult;
import com.flutterforge.model.MicroserviceDefinition;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.io.IOException;
import java.nio.file.*;
import java.util.*;

/**
 * Session 3 — SpringBootCodegen
 * Generates complete Spring Boot 3.2 microservice project.
 */
@Slf4j
@Component
public class SpringBootCodegen {

    public void generateProject(MicroserviceDefinition svc, Path outputDir, GenerationResult result) throws IOException {
        log.info("Session 3 generating Spring Boot: {} -> {}", svc.getName(), outputDir);

        String pkg     = svc.getGroupId() + "." + toPackageName(svc.getArtifactId());
        String pkgPath = pkg.replace(".", "/");
        String name    = capitalize(toCamelCase(svc.getArtifactId()));

        Path javaDir = outputDir.resolve("src/main/java/" + pkgPath);
        Path testDir = outputDir.resolve("src/test/java/" + pkgPath);
        Path resDir  = outputDir.resolve("src/main/resources");

        for (String sub : List.of("controller","service","service/impl","repository","entity","dto","config","exception")) {
            Files.createDirectories(javaDir.resolve(sub));
        }
        Files.createDirectories(testDir.resolve("controller"));
        Files.createDirectories(resDir.resolve("db/migration"));

        write(outputDir.resolve("pom.xml"),                                          buildPom(svc),                      result);
        write(javaDir.resolve("Application.java"),                                   buildApplication(pkg, name),        result);
        write(javaDir.resolve("controller/" + name + "Controller.java"),             buildController(pkg, name, svc),    result);
        write(javaDir.resolve("service/" + name + "Service.java"),                   buildServiceInterface(pkg, name),   result);
        write(javaDir.resolve("service/impl/" + name + "ServiceImpl.java"),          buildServiceImpl(pkg, name),        result);
        write(javaDir.resolve("repository/" + name + "Repository.java"),             buildRepository(pkg, name),         result);
        write(javaDir.resolve("entity/" + name + "Entity.java"),                     buildEntity(pkg, name, svc),        result);
        write(javaDir.resolve("dto/" + name + "Request.java"),                       buildRequestDto(pkg, name),         result);
        write(javaDir.resolve("dto/" + name + "Response.java"),                      buildResponseDto(pkg, name),        result);
        write(javaDir.resolve("dto/PagedResponse.java"),                             buildPagedResponseDto(pkg),         result);
        write(javaDir.resolve("config/SecurityConfig.java"),                         buildSecurityConfig(pkg, svc),      result);
        write(javaDir.resolve("config/OpenApiConfig.java"),                          buildOpenApiConfig(pkg, name, svc), result);
        write(javaDir.resolve("exception/NotFoundException.java"),                   buildNotFoundException(pkg),        result);
        write(javaDir.resolve("exception/" + name + "NotFoundException.java"),       buildEntityNotFoundException(pkg, name), result);
        write(javaDir.resolve("exception/GlobalExceptionHandler.java"),              buildExceptionHandler(pkg),         result);
        write(resDir.resolve("application.yml"),                                     buildApplicationYml(svc),           result);
        write(resDir.resolve("application-dev.yml"),                                 buildDevYml(svc),                   result);
        write(resDir.resolve("application-prod.yml"),                                buildProdYml(svc),                  result);
        write(resDir.resolve("db/migration/V1__init.sql"),                           buildFlywayMigration(name, svc),    result);
        write(testDir.resolve("controller/" + name + "ControllerTest.java"),         buildControllerTest(pkg, name, svc),result);

        log.info("Spring Boot generation complete: {} files", result.getGeneratedFiles().size());
    }

    private String buildPom(MicroserviceDefinition svc) {
        boolean hasJpa   = svc.getDatabase() != null;
        boolean hasKafka = svc.getKafkaTopics() != null && !svc.getKafkaTopics().isEmpty();
        boolean hasJwt   = svc.getSecurity() != null && "jwt".equals(svc.getSecurity().get("scheme"));

        StringBuilder deps = new StringBuilder();
        deps.append("    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>\n");
        deps.append("    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-actuator</artifactId></dependency>\n");
        deps.append("    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-validation</artifactId></dependency>\n");
        if (hasJpa) {
            deps.append("    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-data-jpa</artifactId></dependency>\n");
            deps.append("    <dependency><groupId>org.postgresql</groupId><artifactId>postgresql</artifactId><scope>runtime</scope></dependency>\n");
            deps.append("    <dependency><groupId>org.flywaydb</groupId><artifactId>flyway-core</artifactId></dependency>\n");
            deps.append("    <dependency><groupId>org.flywaydb</groupId><artifactId>flyway-database-postgresql</artifactId></dependency>\n");
        }
        if (hasJwt) {
            deps.append("    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-security</artifactId></dependency>\n");
            deps.append("    <dependency><groupId>io.jsonwebtoken</groupId><artifactId>jjwt-api</artifactId><version>0.12.5</version></dependency>\n");
            deps.append("    <dependency><groupId>io.jsonwebtoken</groupId><artifactId>jjwt-impl</artifactId><version>0.12.5</version><scope>runtime</scope></dependency>\n");
            deps.append("    <dependency><groupId>io.jsonwebtoken</groupId><artifactId>jjwt-jackson</artifactId><version>0.12.5</version><scope>runtime</scope></dependency>\n");
        }
        if (hasKafka) {
            deps.append("    <dependency><groupId>org.springframework.kafka</groupId><artifactId>spring-kafka</artifactId></dependency>\n");
        }
        deps.append("    <dependency><groupId>org.springdoc</groupId><artifactId>springdoc-openapi-starter-webmvc-ui</artifactId><version>2.3.0</version></dependency>\n");
        deps.append("    <dependency><groupId>org.projectlombok</groupId><artifactId>lombok</artifactId><optional>true</optional></dependency>\n");
        deps.append("    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-test</artifactId><scope>test</scope></dependency>\n");

        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<project xmlns=\"http://maven.apache.org/POM/4.0.0\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xsi:schemaLocation=\"http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd\">\n"
             + "  <modelVersion>4.0.0</modelVersion>\n"
             + "  <parent><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-parent</artifactId><version>3.2.2</version><relativePath/></parent>\n"
             + "  <groupId>" + svc.getGroupId() + "</groupId>\n"
             + "  <artifactId>" + svc.getArtifactId() + "</artifactId>\n"
             + "  <version>" + (svc.getVersion()!=null?svc.getVersion():"1.0.0") + "</version>\n"
             + "  <name>" + svc.getName() + "</name>\n"
             + "  <description>" + (svc.getDescription()!=null?svc.getDescription():svc.getName()) + " — Generated by FlutterForge Session 3</description>\n"
             + "  <properties><java.version>" + (svc.getJavaVersion()!=null?svc.getJavaVersion():"21") + "</java.version></properties>\n"
             + "  <dependencies>\n" + deps + "  </dependencies>\n"
             + "  <build><plugins><plugin><groupId>org.springframework.boot</groupId><artifactId>spring-boot-maven-plugin</artifactId>"
             + "<configuration><finalName>" + svc.getArtifactId() + "</finalName></configuration></plugin></plugins></build>\n"
             + "</project>\n";
    }

    private String buildApplication(String pkg, String name) {
        return "package " + pkg + ";\n\nimport org.springframework.boot.SpringApplication;\nimport org.springframework.boot.autoconfigure.SpringBootApplication;\n\n"
             + "@SpringBootApplication\npublic class Application {\n    public static void main(String[] args) {\n        SpringApplication.run(Application.class, args);\n    }\n}\n";
    }

    private String buildController(String pkg, String name, MicroserviceDefinition svc) {
        String base  = (svc.getApiBasePath()!=null?svc.getApiBasePath():"/api/v1") + "/" + toKebabCase(name) + "s";
        String lname = lcFirst(name);
        return "package " + pkg + ".controller;\n\nimport " + pkg + ".dto.*;\nimport " + pkg + ".service." + name + "Service;\n"
             + "import io.swagger.v3.oas.annotations.Operation;\nimport io.swagger.v3.oas.annotations.tags.Tag;\n"
             + "import jakarta.validation.Valid;\nimport lombok.RequiredArgsConstructor;\nimport lombok.extern.slf4j.Slf4j;\n"
             + "import org.springframework.data.domain.Pageable;\nimport org.springframework.data.web.PageableDefault;\n"
             + "import org.springframework.http.*;\nimport org.springframework.web.bind.annotation.*;\nimport java.util.UUID;\n\n"
             + "@Slf4j\n@RestController\n@RequestMapping(\"" + base + "\")\n@RequiredArgsConstructor\n@Tag(name=\"" + name + "\")\n"
             + "public class " + name + "Controller {\n    private final " + name + "Service " + lname + "Service;\n\n"
             + "    @GetMapping\n    @Operation(summary=\"List all " + lname + "s\")\n"
             + "    public ResponseEntity<PagedResponse<" + name + "Response>> list(@PageableDefault(size=20) Pageable p) {\n"
             + "        return ResponseEntity.ok(" + lname + "Service.findAll(p));\n    }\n\n"
             + "    @GetMapping(\"/{id}\")\n    @Operation(summary=\"Get " + lname + " by ID\")\n"
             + "    public ResponseEntity<" + name + "Response> getById(@PathVariable UUID id) {\n"
             + "        return ResponseEntity.ok(" + lname + "Service.findById(id));\n    }\n\n"
             + "    @PostMapping\n    @Operation(summary=\"Create " + lname + "\")\n"
             + "    public ResponseEntity<" + name + "Response> create(@Valid @RequestBody " + name + "Request req) {\n"
             + "        return ResponseEntity.status(HttpStatus.CREATED).body(" + lname + "Service.create(req));\n    }\n\n"
             + "    @PutMapping(\"/{id}\")\n    @Operation(summary=\"Update " + lname + "\")\n"
             + "    public ResponseEntity<" + name + "Response> update(@PathVariable UUID id, @Valid @RequestBody " + name + "Request req) {\n"
             + "        return ResponseEntity.ok(" + lname + "Service.update(id, req));\n    }\n\n"
             + "    @DeleteMapping(\"/{id}\")\n    @Operation(summary=\"Delete " + lname + "\")\n"
             + "    public ResponseEntity<Void> delete(@PathVariable UUID id) {\n"
             + "        " + lname + "Service.delete(id);\n        return ResponseEntity.noContent().build();\n    }\n}\n";
    }

    private String buildServiceInterface(String pkg, String name) {
        return "package " + pkg + ".service;\nimport " + pkg + ".dto.*;\nimport org.springframework.data.domain.Pageable;\nimport java.util.UUID;\n\n"
             + "public interface " + name + "Service {\n"
             + "    PagedResponse<" + name + "Response> findAll(Pageable pageable);\n"
             + "    " + name + "Response findById(UUID id);\n"
             + "    " + name + "Response create(" + name + "Request request);\n"
             + "    " + name + "Response update(UUID id, " + name + "Request request);\n"
             + "    void delete(UUID id);\n}\n";
    }

    private String buildServiceImpl(String pkg, String name) {
        String lname = lcFirst(name);
        String repo  = lname + "Repository";
        return "package " + pkg + ".service.impl;\nimport " + pkg + ".dto.*;\nimport " + pkg + ".entity.*;\nimport " + pkg + ".exception.*;\nimport " + pkg + ".repository.*;\nimport " + pkg + ".service.*;\n"
             + "import lombok.RequiredArgsConstructor;\nimport lombok.extern.slf4j.Slf4j;\n"
             + "import org.springframework.data.domain.*;\nimport org.springframework.stereotype.Service;\nimport org.springframework.transaction.annotation.Transactional;\nimport java.util.UUID;\n\n"
             + "@Slf4j\n@Service\n@RequiredArgsConstructor\n@Transactional(readOnly=true)\n"
             + "public class " + name + "ServiceImpl implements " + name + "Service {\n"
             + "    private final " + name + "Repository " + repo + ";\n\n"
             + "    @Override\n    public PagedResponse<" + name + "Response> findAll(Pageable p) {\n"
             + "        Page<" + name + "Entity> page = " + repo + ".findAll(p);\n"
             + "        return PagedResponse.of(page.map(this::toResponse));\n    }\n\n"
             + "    @Override\n    public " + name + "Response findById(UUID id) {\n"
             + "        return " + repo + ".findById(id).map(this::toResponse).orElseThrow(() -> new " + name + "NotFoundException(id));\n    }\n\n"
             + "    @Override\n    @Transactional\n    public " + name + "Response create(" + name + "Request req) {\n"
             + "        " + name + "Entity e = toEntity(req);\n        e = " + repo + ".save(e);\n"
             + "        log.info(\"Created " + name + " id={}\", e.getId());\n        return toResponse(e);\n    }\n\n"
             + "    @Override\n    @Transactional\n    public " + name + "Response update(UUID id, " + name + "Request req) {\n"
             + "        " + name + "Entity e = " + repo + ".findById(id).orElseThrow(() -> new " + name + "NotFoundException(id));\n"
             + "        updateEntity(e, req);\n        e = " + repo + ".save(e);\n        return toResponse(e);\n    }\n\n"
             + "    @Override\n    @Transactional\n    public void delete(UUID id) {\n"
             + "        if (!" + repo + ".existsById(id)) throw new " + name + "NotFoundException(id);\n"
             + "        " + repo + ".deleteById(id);\n    }\n\n"
             + "    private " + name + "Response toResponse(" + name + "Entity e) {\n"
             + "        return " + name + "Response.builder().id(e.getId()).build(); // TODO: map fields\n    }\n\n"
             + "    private " + name + "Entity toEntity(" + name + "Request req) {\n"
             + "        return " + name + "Entity.builder().build(); // TODO: map fields\n    }\n\n"
             + "    private void updateEntity(" + name + "Entity e, " + name + "Request req) {\n        // TODO: update fields\n    }\n}\n";
    }

    private String buildRepository(String pkg, String name) {
        return "package " + pkg + ".repository;\nimport " + pkg + ".entity." + name + "Entity;\n"
             + "import org.springframework.data.jpa.repository.*;\nimport org.springframework.stereotype.Repository;\nimport java.util.UUID;\n\n"
             + "@Repository\npublic interface " + name + "Repository extends JpaRepository<" + name + "Entity, UUID>, JpaSpecificationExecutor<" + name + "Entity> {}\n";
    }

    private String buildEntity(String pkg, String name, MicroserviceDefinition svc) {
        String table = toSnakeCase(name) + "s";
        String fields = "    @Column(name=\"name\", nullable=false)\n    private String name;\n\n"
                      + "    @Column(name=\"description\")\n    private String description;\n\n"
                      + "    @Column(name=\"active\")\n    private boolean active = true;\n\n";

        return "package " + pkg + ".entity;\nimport jakarta.persistence.*;\nimport lombok.*;\n"
             + "import org.hibernate.annotations.*;\nimport java.time.LocalDateTime;\nimport java.util.UUID;\n\n"
             + "@Entity\n@Table(name=\"" + table + "\")\n@Getter\n@Setter\n@Builder\n@NoArgsConstructor\n@AllArgsConstructor\n"
             + "public class " + name + "Entity {\n"
             + "    @Id\n    @GeneratedValue(strategy=GenerationType.UUID)\n    @Column(name=\"id\", updatable=false, nullable=false)\n    private UUID id;\n\n"
             + fields
             + "    @CreationTimestamp\n    @Column(name=\"created_at\", updatable=false)\n    private LocalDateTime createdAt;\n\n"
             + "    @UpdateTimestamp\n    @Column(name=\"updated_at\")\n    private LocalDateTime updatedAt;\n}\n";
    }

    private String buildRequestDto(String pkg, String name) {
        return "package " + pkg + ".dto;\nimport jakarta.validation.constraints.*;\nimport lombok.*;\n\n"
             + "@Data\n@Builder\n@NoArgsConstructor\n@AllArgsConstructor\npublic class " + name + "Request {\n"
             + "    @NotBlank(message=\"Name is required\")\n    @Size(min=1, max=255)\n    private String name;\n"
             + "    private String description;\n}\n";
    }

    private String buildResponseDto(String pkg, String name) {
        return "package " + pkg + ".dto;\nimport com.fasterxml.jackson.annotation.*;\nimport lombok.*;\nimport java.time.LocalDateTime;\nimport java.util.UUID;\n\n"
             + "@Data\n@Builder\n@NoArgsConstructor\n@AllArgsConstructor\npublic class " + name + "Response {\n"
             + "    private UUID id;\n    private String name;\n    private String description;\n    private boolean active;\n"
             + "    @JsonFormat(pattern=\"yyyy-MM-dd'T'HH:mm:ss\")\n    private LocalDateTime createdAt;\n"
             + "    @JsonFormat(pattern=\"yyyy-MM-dd'T'HH:mm:ss\")\n    private LocalDateTime updatedAt;\n}\n";
    }

    private String buildPagedResponseDto(String pkg) {
        return "package " + pkg + ".dto;\nimport lombok.*;\nimport org.springframework.data.domain.Page;\nimport java.util.List;\n\n"
             + "@Data\n@Builder\n@NoArgsConstructor\n@AllArgsConstructor\npublic class PagedResponse<T> {\n"
             + "    private List<T> content;\n    private int page;\n    private int size;\n"
             + "    private long totalElements;\n    private int totalPages;\n    private boolean last;\n\n"
             + "    public static <T> PagedResponse<T> of(Page<T> page) {\n"
             + "        return PagedResponse.<T>builder().content(page.getContent()).page(page.getNumber())\n"
             + "            .size(page.getSize()).totalElements(page.getTotalElements())\n"
             + "            .totalPages(page.getTotalPages()).last(page.isLast()).build();\n    }\n}\n";
    }

    private String buildSecurityConfig(String pkg, MicroserviceDefinition svc) {
        return "package " + pkg + ".config;\nimport org.springframework.context.annotation.*;\n"
             + "import org.springframework.security.config.annotation.web.builders.HttpSecurity;\n"
             + "import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;\n"
             + "import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;\n"
             + "import org.springframework.security.config.http.SessionCreationPolicy;\n"
             + "import org.springframework.security.web.SecurityFilterChain;\n"
             + "import org.springframework.web.cors.*;\nimport java.util.List;\n\n"
             + "@Configuration\n@EnableWebSecurity\npublic class SecurityConfig {\n\n"
             + "    @Bean\n    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {\n"
             + "        return http.csrf(AbstractHttpConfigurer::disable)\n"
             + "            .cors(c -> c.configurationSource(corsSource()))\n"
             + "            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))\n"
             + "            .authorizeHttpRequests(a -> a\n"
             + "                .requestMatchers(\"/actuator/**\",\"/swagger-ui/**\",\"/v3/api-docs/**\").permitAll()\n"
             + "                .anyRequest().authenticated())\n"
             + "            .build();\n    }\n\n"
             + "    @Bean\n    public CorsConfigurationSource corsSource() {\n"
             + "        CorsConfiguration c = new CorsConfiguration();\n"
             + "        c.setAllowedOriginPatterns(List.of(\"*\"));\n"
             + "        c.setAllowedMethods(List.of(\"GET\",\"POST\",\"PUT\",\"DELETE\",\"PATCH\",\"OPTIONS\"));\n"
             + "        c.setAllowedHeaders(List.of(\"*\"));\n"
             + "        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();\n"
             + "        src.registerCorsConfiguration(\"/**\", c);\n        return src;\n    }\n}\n";
    }

    private String buildOpenApiConfig(String pkg, String name, MicroserviceDefinition svc) {
        int port = svc.getPort()!=null?svc.getPort():8080;
        return "package " + pkg + ".config;\nimport io.swagger.v3.oas.models.*;\nimport io.swagger.v3.oas.models.info.*;\nimport io.swagger.v3.oas.models.servers.*;\n"
             + "import org.springframework.context.annotation.*;\nimport java.util.List;\n\n"
             + "@Configuration\npublic class OpenApiConfig {\n    @Bean\n    public OpenAPI openAPI() {\n"
             + "        return new OpenAPI().info(new Info().title(\"" + name + " API\").version(\"" + (svc.getVersion()!=null?svc.getVersion():"1.0.0") + "\"))\n"
             + "            .servers(List.of(new Server().url(\"http://localhost:" + port + "\").description(\"Local\")));\n    }\n}\n";
    }

    private String buildNotFoundException(String pkg) {
        return "package " + pkg + ".exception;\npublic class NotFoundException extends RuntimeException {\n"
             + "    public NotFoundException(String msg) { super(msg); }\n}\n";
    }

    private String buildEntityNotFoundException(String pkg, String name) {
        return "package " + pkg + ".exception;\nimport java.util.UUID;\n\n"
             + "public class " + name + "NotFoundException extends NotFoundException {\n"
             + "    public " + name + "NotFoundException(UUID id) { super(\"" + name + " not found: \" + id); }\n"
             + "    public " + name + "NotFoundException(String msg) { super(msg); }\n}\n";
    }

    private String buildExceptionHandler(String pkg) {
        return "package " + pkg + ".exception;\nimport lombok.extern.slf4j.Slf4j;\n"
             + "import org.springframework.http.*;\nimport org.springframework.web.bind.*;\nimport org.springframework.web.bind.annotation.*;\n"
             + "import java.time.Instant;\nimport java.util.*;\n\n"
             + "@Slf4j\n@RestControllerAdvice\npublic class GlobalExceptionHandler {\n\n"
             + "    @ExceptionHandler(NotFoundException.class)\n    public ProblemDetail handleNotFound(NotFoundException ex) {\n"
             + "        log.warn(\"Not found: {}\", ex.getMessage());\n"
             + "        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());\n"
             + "        pd.setProperty(\"timestamp\", Instant.now()); return pd;\n    }\n\n"
             + "    @ExceptionHandler(MethodArgumentNotValidException.class)\n    public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {\n"
             + "        Map<String,String> errors = new HashMap<>();\n"
             + "        ex.getBindingResult().getFieldErrors().forEach(e -> errors.put(e.getField(), e.getDefaultMessage()));\n"
             + "        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, \"Validation failed\");\n"
             + "        pd.setProperty(\"errors\", errors); pd.setProperty(\"timestamp\", Instant.now()); return pd;\n    }\n\n"
             + "    @ExceptionHandler(Exception.class)\n    public ProblemDetail handleGeneral(Exception ex) {\n"
             + "        log.error(\"Unexpected error\", ex);\n"
             + "        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, \"Unexpected error\");\n"
             + "        pd.setProperty(\"timestamp\", Instant.now()); return pd;\n    }\n}\n";
    }

    private String buildApplicationYml(MicroserviceDefinition svc) {
        int port = svc.getPort()!=null?svc.getPort():8080;
        boolean hasJpa = svc.getDatabase()!=null;
        StringBuilder yml = new StringBuilder();
        yml.append("server:\n  port: ").append(port).append("\n\n");
        yml.append("spring:\n  application:\n    name: ").append(svc.getArtifactId()).append("\n");
        yml.append("  profiles:\n    active: ${SPRING_PROFILES_ACTIVE:dev}\n\n");
        if (hasJpa) {
            yml.append("  jpa:\n    hibernate:\n      ddl-auto: validate\n    show-sql: false\n    open-in-view: false\n\n");
            yml.append("  flyway:\n    enabled: true\n    locations: classpath:db/migration\n\n");
        }
        yml.append("management:\n  endpoints:\n    web:\n      exposure:\n        include: health,info,metrics\n\n");
        yml.append("logging:\n  level:\n    root: INFO\n    ").append(svc.getGroupId()).append(": DEBUG\n");
        return yml.toString();
    }

    private String buildDevYml(MicroserviceDefinition svc) {
        boolean hasJpa = svc.getDatabase()!=null;
        String dbName = svc.getArtifactId()!=null ? svc.getArtifactId().replace("-","_")+"_db" : "service_db";
        StringBuilder yml = new StringBuilder("# Dev profile\nspring:\n");
        if (hasJpa) {
            yml.append("  datasource:\n    url: jdbc:postgresql://localhost:5432/").append(dbName).append("\n");
            yml.append("    username: postgres\n    password: postgres\n\n  jpa:\n    show-sql: true\n\n");
        }
        yml.append("logging:\n  level:\n    root: DEBUG\n");
        return yml.toString();
    }

    private String buildProdYml(MicroserviceDefinition svc) {
        boolean hasJpa = svc.getDatabase()!=null;
        StringBuilder yml = new StringBuilder("# Prod profile\nspring:\n");
        if (hasJpa) yml.append("  datasource:\n    url: ${DB_URL}\n    username: ${DB_USERNAME}\n    password: ${DB_PASSWORD}\n\n");
        yml.append("logging:\n  level:\n    root: WARN\n    ").append(svc.getGroupId()).append(": INFO\n");
        return yml.toString();
    }

    private String buildFlywayMigration(String name, MicroserviceDefinition svc) {
        String table = toSnakeCase(name) + "s";
        StringBuilder sql = new StringBuilder("-- V1__init.sql — Generated by FlutterForge Session 3\n\n");
        sql.append("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";\n\n");
        sql.append("CREATE TABLE IF NOT EXISTS ").append(table).append(" (\n");
        sql.append("    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n");
        sql.append("    name        VARCHAR(255) NOT NULL,\n");
        sql.append("    description TEXT,\n");
        sql.append("    active      BOOLEAN NOT NULL DEFAULT TRUE,\n");
        sql.append("    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),\n");
        sql.append("    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()\n);\n\n");
        sql.append("CREATE INDEX IF NOT EXISTS idx_").append(table).append("_created_at ON ").append(table).append(" (created_at DESC);\n");
        return sql.toString();
    }

    private String buildControllerTest(String pkg, String name, MicroserviceDefinition svc) {
        String lname = lcFirst(name);
        String base  = (svc.getApiBasePath()!=null?svc.getApiBasePath():"/api/v1") + "/" + toKebabCase(name) + "s";
        return "package " + pkg + ".controller;\nimport " + pkg + ".dto.*;\nimport " + pkg + ".service." + name + "Service;\n"
             + "import com.fasterxml.jackson.databind.ObjectMapper;\nimport org.junit.jupiter.api.*;\n"
             + "import org.springframework.beans.factory.annotation.Autowired;\nimport org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;\n"
             + "import org.springframework.boot.test.mock.mockito.MockBean;\nimport org.springframework.data.domain.Pageable;\n"
             + "import org.springframework.http.MediaType;\nimport org.springframework.test.web.servlet.MockMvc;\nimport java.util.*;\n"
             + "import static org.mockito.ArgumentMatchers.*;\nimport static org.mockito.Mockito.*;\n"
             + "import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;\n"
             + "import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;\n\n"
             + "@WebMvcTest(" + name + "Controller.class)\n@DisplayName(\"" + name + " Controller Tests\")\n"
             + "class " + name + "ControllerTest {\n"
             + "    @Autowired MockMvc mockMvc;\n    @Autowired ObjectMapper objectMapper;\n    @MockBean " + name + "Service " + lname + "Service;\n\n"
             + "    @Test\n    @DisplayName(\"GET " + base + " returns 200\")\n    void list_returns200() throws Exception {\n"
             + "        when(" + lname + "Service.findAll(any(Pageable.class))).thenReturn(\n"
             + "            PagedResponse.<" + name + "Response>builder().content(List.of()).page(0).size(20).totalElements(0).totalPages(0).last(true).build());\n"
             + "        mockMvc.perform(get(\"" + base + "\")).andExpect(status().isOk());\n    }\n\n"
             + "    @Test\n    @DisplayName(\"POST " + base + " returns 201\")\n    void create_returns201() throws Exception {\n"
             + "        " + name + "Request req = new " + name + "Request();\n        req.setName(\"Test\");\n"
             + "        when(" + lname + "Service.create(any())).thenReturn(" + name + "Response.builder().id(UUID.randomUUID()).name(\"Test\").build());\n"
             + "        mockMvc.perform(post(\"" + base + "\").contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(req)))\n"
             + "            .andExpect(status().isCreated());\n    }\n}\n";
    }

    private void write(Path path, String content, GenerationResult result) throws IOException {
        Files.createDirectories(path.getParent());
        Files.writeString(path, content, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        result.getGeneratedFiles().add(path.toString());
    }

    private String toPackageName(String a) { return a!=null?a.replace("-","").toLowerCase():"service"; }
    private String toKebabCase(String n) { return n!=null?n.replaceAll("([A-Z])","-$1").toLowerCase().replaceAll("^-",""):""; }
    private String toSnakeCase(String n) { return n!=null?n.replaceAll("([A-Z]+)([A-Z][a-z])","$1_$2").replaceAll("([a-z0-9])([A-Z])","$1_$2").toLowerCase():""; }
    private String toCamelCase(String s) {
        if (s==null) return "";
        String[] p = s.split("-");
        StringBuilder sb = new StringBuilder(p[0]);
        for (int i=1;i<p.length;i++) if (!p[i].isEmpty()) sb.append(Character.toUpperCase(p[i].charAt(0))).append(p[i].substring(1));
        return sb.toString();
    }
    private String capitalize(String s) { return s==null||s.isEmpty()?s:Character.toUpperCase(s.charAt(0))+s.substring(1); }
    private String lcFirst(String s)    { return s==null||s.isEmpty()?s:Character.toLowerCase(s.charAt(0))+s.substring(1); }
}
