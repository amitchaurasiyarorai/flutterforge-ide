package com.flutterforge.codegen.service;

import com.flutterforge.model.GenerationResult;
import com.flutterforge.model.MicroserviceDefinition;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;

import static org.assertj.core.api.Assertions.*;

/**
 * Session 3 — Spring Boot Codegen Tests
 */
@SpringBootTest
@DisplayName("Session 3 — SpringBootCodegen Tests")
class SpringBootCodegenSession3Test {

    @Autowired SpringBootCodegen springBootCodegen;
    @Autowired GatewayCodegen    gatewayCodegen;

    private Path tempDir;

    @BeforeEach
    void setup() throws IOException {
        tempDir = Files.createTempDirectory("flutterforge-test-");
    }

    @AfterEach
    void cleanup() throws IOException {
        deleteRecursively(tempDir);
    }

    // ─────────────────────────────────────────────────────────
    // SpringBootCodegen Tests
    // ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("generates pom.xml with correct groupId and artifactId")
    void generateProject_pomXmlCorrect() throws IOException {
        MicroserviceDefinition svc = buildService("UserService", "user-service", "com.example");
        GenerationResult result = new GenerationResult();

        springBootCodegen.generateProject(svc, tempDir, result);

        Path pom = tempDir.resolve("pom.xml");
        assertThat(pom).exists();
        String content = Files.readString(pom);
        assertThat(content).contains("<groupId>com.example</groupId>");
        assertThat(content).contains("<artifactId>user-service</artifactId>");
        assertThat(content).contains("spring-boot-starter-web");
        assertThat(content).contains("spring-boot-starter-validation");
        assertThat(content).contains("springdoc-openapi-starter-webmvc-ui");
    }

    @Test
    @DisplayName("generates Application.java with SpringBootApplication annotation")
    void generateProject_applicationJavaCorrect() throws IOException {
        MicroserviceDefinition svc = buildService("UserService", "user-service", "com.example");
        GenerationResult result = new GenerationResult();

        springBootCodegen.generateProject(svc, tempDir, result);

        Path appFile = tempDir.resolve("src/main/java/com/example/userservice/Application.java");
        assertThat(appFile).exists();
        String content = Files.readString(appFile);
        assertThat(content).contains("@SpringBootApplication");
        assertThat(content).contains("SpringApplication.run");
        assertThat(content).contains("package com.example.userservice");
    }

    @Test
    @DisplayName("generates Controller with CRUD endpoints")
    void generateProject_controllerHasCrudEndpoints() throws IOException {
        MicroserviceDefinition svc = buildService("UserService", "user-service", "com.example");
        GenerationResult result = new GenerationResult();

        springBootCodegen.generateProject(svc, tempDir, result);

        Path controller = tempDir.resolve("src/main/java/com/example/userservice/controller/UserserviceController.java");
        assertThat(controller).exists();
        String content = Files.readString(controller);
        assertThat(content).contains("@RestController");
        assertThat(content).contains("@GetMapping");
        assertThat(content).contains("@PostMapping");
        assertThat(content).contains("@PutMapping");
        assertThat(content).contains("@DeleteMapping");
        assertThat(content).contains("@Tag");
    }

    @Test
    @DisplayName("generates Service interface and impl")
    void generateProject_serviceInterfaceAndImpl() throws IOException {
        MicroserviceDefinition svc = buildService("UserService", "user-service", "com.example");
        GenerationResult result = new GenerationResult();

        springBootCodegen.generateProject(svc, tempDir, result);

        Path svcInterface = tempDir.resolve("src/main/java/com/example/userservice/service/UserserviceService.java");
        Path svcImpl      = tempDir.resolve("src/main/java/com/example/userservice/service/impl/UserserviceServiceImpl.java");

        assertThat(svcInterface).exists();
        assertThat(svcImpl).exists();

        String ifaceContent = Files.readString(svcInterface);
        assertThat(ifaceContent).contains("interface UserserviceService");
        assertThat(ifaceContent).contains("findAll");
        assertThat(ifaceContent).contains("findById");
        assertThat(ifaceContent).contains("create");
        assertThat(ifaceContent).contains("update");
        assertThat(ifaceContent).contains("delete");

        String implContent = Files.readString(svcImpl);
        assertThat(implContent).contains("@Service");
        assertThat(implContent).contains("@Transactional");
        assertThat(implContent).contains("implements UserserviceService");
    }

    @Test
    @DisplayName("generates Repository extending JpaRepository")
    void generateProject_repositoryCorrect() throws IOException {
        MicroserviceDefinition svc = buildService("UserService", "user-service", "com.example");
        GenerationResult result = new GenerationResult();

        springBootCodegen.generateProject(svc, tempDir, result);

        Path repo = tempDir.resolve("src/main/java/com/example/userservice/repository/UserserviceRepository.java");
        assertThat(repo).exists();
        String content = Files.readString(repo);
        assertThat(content).contains("@Repository");
        assertThat(content).contains("JpaRepository");
        assertThat(content).contains("JpaSpecificationExecutor");
    }

    @Test
    @DisplayName("generates Entity with JPA annotations")
    void generateProject_entityCorrect() throws IOException {
        MicroserviceDefinition svc = buildService("UserService", "user-service", "com.example");
        GenerationResult result = new GenerationResult();

        springBootCodegen.generateProject(svc, tempDir, result);

        Path entity = tempDir.resolve("src/main/java/com/example/userservice/entity/UserserviceEntity.java");
        assertThat(entity).exists();
        String content = Files.readString(entity);
        assertThat(content).contains("@Entity");
        assertThat(content).contains("@Table");
        assertThat(content).contains("@Id");
        assertThat(content).contains("@GeneratedValue");
        assertThat(content).contains("@Builder");
        assertThat(content).contains("createdAt");
        assertThat(content).contains("updatedAt");
    }

    @Test
    @DisplayName("generates DTOs with Lombok annotations")
    void generateProject_dtosCorrect() throws IOException {
        MicroserviceDefinition svc = buildService("UserService", "user-service", "com.example");
        GenerationResult result = new GenerationResult();

        springBootCodegen.generateProject(svc, tempDir, result);

        Path req  = tempDir.resolve("src/main/java/com/example/userservice/dto/UserserviceRequest.java");
        Path resp = tempDir.resolve("src/main/java/com/example/userservice/dto/UserserviceResponse.java");
        Path paged = tempDir.resolve("src/main/java/com/example/userservice/dto/PagedResponse.java");

        assertThat(req).exists();
        assertThat(resp).exists();
        assertThat(paged).exists();

        assertThat(Files.readString(req)).contains("@Data").contains("@NotBlank");
        assertThat(Files.readString(resp)).contains("@Data").contains("UUID id");
        assertThat(Files.readString(paged)).contains("PagedResponse<T>").contains("of(Page<T> page)");
    }

    @Test
    @DisplayName("generates SecurityConfig with JWT support")
    void generateProject_securityConfigCorrect() throws IOException {
        MicroserviceDefinition svc = buildService("UserService", "user-service", "com.example");
        svc.setSecurity(Map.of("scheme","jwt","publicPaths", List.of("/actuator/**")));
        GenerationResult result = new GenerationResult();

        springBootCodegen.generateProject(svc, tempDir, result);

        Path security = tempDir.resolve("src/main/java/com/example/userservice/config/SecurityConfig.java");
        assertThat(security).exists();
        String content = Files.readString(security);
        assertThat(content).contains("@EnableWebSecurity");
        assertThat(content).contains("SecurityFilterChain");
        assertThat(content).contains("STATELESS");
        assertThat(content).contains("corsSource");
    }

    @Test
    @DisplayName("generates OpenAPI config")
    void generateProject_openApiConfigCorrect() throws IOException {
        MicroserviceDefinition svc = buildService("UserService", "user-service", "com.example");
        GenerationResult result = new GenerationResult();

        springBootCodegen.generateProject(svc, tempDir, result);

        Path openApi = tempDir.resolve("src/main/java/com/example/userservice/config/OpenApiConfig.java");
        assertThat(openApi).exists();
        String content = Files.readString(openApi);
        assertThat(content).contains("OpenAPI");
        assertThat(content).contains("Info");
        assertThat(content).contains("Server");
    }

    @Test
    @DisplayName("generates exception handler")
    void generateProject_exceptionHandlerCorrect() throws IOException {
        MicroserviceDefinition svc = buildService("UserService", "user-service", "com.example");
        GenerationResult result = new GenerationResult();

        springBootCodegen.generateProject(svc, tempDir, result);

        Path handler = tempDir.resolve("src/main/java/com/example/userservice/exception/GlobalExceptionHandler.java");
        assertThat(handler).exists();
        String content = Files.readString(handler);
        assertThat(content).contains("@RestControllerAdvice");
        assertThat(content).contains("ProblemDetail");
        assertThat(content).contains("NotFoundException");
        assertThat(content).contains("MethodArgumentNotValidException");
    }

    @Test
    @DisplayName("generates application.yml with correct port")
    void generateProject_applicationYmlCorrect() throws IOException {
        MicroserviceDefinition svc = buildService("UserService", "user-service", "com.example");
        svc.setPort(8081);
        GenerationResult result = new GenerationResult();

        springBootCodegen.generateProject(svc, tempDir, result);

        Path yml = tempDir.resolve("src/main/resources/application.yml");
        assertThat(yml).exists();
        String content = Files.readString(yml);
        assertThat(content).contains("port: 8081");
        assertThat(content).contains("name: user-service");
    }

    @Test
    @DisplayName("generates Flyway migration SQL")
    void generateProject_flywayMigrationCorrect() throws IOException {
        MicroserviceDefinition svc = buildService("UserService", "user-service", "com.example");
        GenerationResult result = new GenerationResult();

        springBootCodegen.generateProject(svc, tempDir, result);

        Path sql = tempDir.resolve("src/main/resources/db/migration/V1__init.sql");
        assertThat(sql).exists();
        String content = Files.readString(sql);
        assertThat(content).contains("CREATE TABLE");
        assertThat(content).contains("uuid_generate_v4()");
        assertThat(content).contains("created_at");
        assertThat(content).contains("updated_at");
    }

    @Test
    @DisplayName("generates controller test")
    void generateProject_controllerTestCorrect() throws IOException {
        MicroserviceDefinition svc = buildService("UserService", "user-service", "com.example");
        GenerationResult result = new GenerationResult();

        springBootCodegen.generateProject(svc, tempDir, result);

        Path test = tempDir.resolve("src/test/java/com/example/userservice/controller/UserserviceControllerTest.java");
        assertThat(test).exists();
        String content = Files.readString(test);
        assertThat(content).contains("@WebMvcTest");
        assertThat(content).contains("@MockBean");
        assertThat(content).contains("MockMvc");
        assertThat(content).contains("status().isOk()");
        assertThat(content).contains("status().isCreated()");
    }

    @Test
    @DisplayName("generates pom.xml with JPA deps when database defined")
    void generateProject_jpaDepsWhenDatabaseDefined() throws IOException {
        MicroserviceDefinition svc = buildService("UserService", "user-service", "com.example");
        svc.setDatabase(Map.of("engine","postgresql","name","user_db","tables",List.of(),"flywayEnabled",true));
        GenerationResult result = new GenerationResult();

        springBootCodegen.generateProject(svc, tempDir, result);

        String pom = Files.readString(tempDir.resolve("pom.xml"));
        assertThat(pom).contains("spring-boot-starter-data-jpa");
        assertThat(pom).contains("postgresql");
        assertThat(pom).contains("flyway-core");
    }

    @Test
    @DisplayName("generates pom.xml with Kafka deps when topics defined")
    void generateProject_kafkaDepsWhenTopicsDefined() throws IOException {
        MicroserviceDefinition svc = buildService("OrderService", "order-service", "com.example");
        svc.setKafkaTopics(List.of(Map.of("name","order.created","pattern","publish")));
        GenerationResult result = new GenerationResult();

        springBootCodegen.generateProject(svc, tempDir, result);

        String pom = Files.readString(tempDir.resolve("pom.xml"));
        assertThat(pom).contains("spring-kafka");
    }

    @Test
    @DisplayName("generation result has all expected files")
    void generateProject_resultContainsAllFiles() throws IOException {
        MicroserviceDefinition svc = buildService("ProductService", "product-service", "com.example");
        GenerationResult result = new GenerationResult();

        springBootCodegen.generateProject(svc, tempDir, result);

        assertThat(result.getGeneratedFiles()).hasSizeGreaterThanOrEqualTo(15);
        assertThat(result.hasErrors()).isFalse();
    }

    // ─────────────────────────────────────────────────────────
    // GatewayCodegen Tests
    // ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("generates gateway pom.xml with Spring Cloud Gateway")
    void generateGateway_pomCorrect() throws IOException {
        Map<String, Object> gatewayDef = buildGatewayDef();
        GenerationResult result = new GenerationResult();

        gatewayCodegen.generate(gatewayDef, tempDir, result);

        Path pom = tempDir.resolve("pom.xml");
        assertThat(pom).exists();
        String content = Files.readString(pom);
        assertThat(content).contains("spring-cloud-starter-gateway");
        assertThat(content).contains("spring-cloud-dependencies");
        assertThat(content).contains("jjwt-api");
    }

    @Test
    @DisplayName("generates GatewayApplication.java")
    void generateGateway_applicationCorrect() throws IOException {
        Map<String, Object> gatewayDef = buildGatewayDef();
        GenerationResult result = new GenerationResult();

        gatewayCodegen.generate(gatewayDef, tempDir, result);

        Path app = tempDir.resolve("src/main/java/com/example/gateway/GatewayApplication.java");
        assertThat(app).exists();
        assertThat(Files.readString(app)).contains("@SpringBootApplication");
    }

    @Test
    @DisplayName("generates JWT auth filter")
    void generateGateway_jwtFilterCorrect() throws IOException {
        Map<String, Object> gatewayDef = buildGatewayDef();
        GenerationResult result = new GenerationResult();

        gatewayCodegen.generate(gatewayDef, tempDir, result);

        Path filter = tempDir.resolve("src/main/java/com/example/gateway/filter/JwtAuthFilter.java");
        assertThat(filter).exists();
        String content = Files.readString(filter);
        assertThat(content).contains("GlobalFilter");
        assertThat(content).contains("Bearer ");
        assertThat(content).contains("UNAUTHORIZED");
    }

    @Test
    @DisplayName("generates routing config")
    void generateGateway_routingConfigCorrect() throws IOException {
        Map<String, Object> gatewayDef = buildGatewayDef();
        GenerationResult result = new GenerationResult();

        gatewayCodegen.generate(gatewayDef, tempDir, result);

        Path routing = tempDir.resolve("src/main/java/com/example/gateway/config/GatewayRoutingConfig.java");
        assertThat(routing).exists();
        String content = Files.readString(routing);
        assertThat(content).contains("RouteLocator");
        assertThat(content).contains("RouteLocatorBuilder");
    }

    @Test
    @DisplayName("generates gateway application.yml with correct port")
    void generateGateway_ymlCorrect() throws IOException {
        Map<String, Object> gatewayDef = buildGatewayDef();
        GenerationResult result = new GenerationResult();

        gatewayCodegen.generate(gatewayDef, tempDir, result);

        Path yml = tempDir.resolve("src/main/resources/application.yml");
        assertThat(yml).exists();
        String content = Files.readString(yml);
        assertThat(content).contains("port: 8080");
        assertThat(content).contains("api-gateway");
        assertThat(content).contains("jwt");
        assertThat(content).contains("resilience4j");
    }

    // ─────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────

    private MicroserviceDefinition buildService(String name, String artifactId, String groupId) {
        MicroserviceDefinition svc = new MicroserviceDefinition();
        svc.setId("svc_" + artifactId);
        svc.setName(name);
        svc.setArtifactId(artifactId);
        svc.setGroupId(groupId);
        svc.setVersion("1.0.0");
        svc.setPort(8081);
        svc.setJavaVersion("21");
        svc.setSpringBootVersion("3.2");
        svc.setApiBasePath("/api/v1");
        svc.setEndpoints(new ArrayList<>());
        svc.setSchemas(new ArrayList<>());
        svc.setDependencies(new ArrayList<>());
        svc.setSecurity(Map.of("scheme","jwt","publicPaths",List.of("/actuator/**")));
        return svc;
    }

    private Map<String, Object> buildGatewayDef() {
        return Map.of(
            "id",         "gw_1",
            "groupId",    "com.example",
            "artifactId", "api-gateway",
            "version",    "1.0.0",
            "port",       8080,
            "routes",     List.of()
        );
    }

    private void deleteRecursively(Path path) throws IOException {
        if (!Files.exists(path)) return;
        Files.walk(path)
             .sorted(Comparator.reverseOrder())
             .forEach(p -> { try { Files.delete(p); } catch (IOException ignored) {} });
    }
}
