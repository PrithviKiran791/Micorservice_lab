<#
.SYNOPSIS
  Writes docs/viva/CODE_REFERENCES.md: the key concepts of the project with the exact file, line number and code snippet.

.DESCRIPTION
  Line numbers are NEVER typed by hand. For every entry below the script searches the real source file for the snippet
  and records the line where it is found. Run it again after editing the code, then run verify-references.ps1.
  If a snippet is not found the script stops with an error, so the document cannot silently contain a wrong reference.

  .\scripts\generate-references.ps1
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$j = 'src/main/java/com/resqnet'

# Each entry: topic, concept, file (relative to repo root), snippet (exact text that appears on ONE line), class.method, rubric row
$entries = @(
    @('Atomic assignment (responder-service)', 'The SQL that locks one free responder row', "responder-service/$j/responder/repository/ResponderRepository.java", 'FOR UPDATE SKIP LOCKED', 'ResponderRepository.lockFirstAvailable', 'Database, Cross-service'),
    @('Atomic assignment (responder-service)', 'Assign runs as one transaction', "responder-service/$j/responder/service/ResponderService.java", 'public AssignResponse assign(AssignRequest request)', 'ResponderService.assign (@Transactional on the line above)', 'Cross-service'),
    @('Atomic assignment (responder-service)', 'Idempotency: the same incident never takes a second responder', "responder-service/$j/responder/service/ResponderService.java", 'repository.findByCurrentIncidentId(incidentId)', 'ResponderService.assign', 'Cross-service'),
    @('Atomic assignment (responder-service)', 'Database-level guard: one incident, one responder', 'responder-service/src/main/resources/schema.sql', 'CREATE UNIQUE INDEX IF NOT EXISTS uq_responder_current_incident', 'schema.sql', 'Database'),
    @('Atomic assignment (responder-service)', 'Test: 10 simultaneous assigns, only 3 ambulances', "responder-service/src/test/java/com/resqnet/responder/service/ResponderServiceConcurrencyTest.java", 'void concurrentAssignmentsNeverGiveTheSameResponder()', 'ResponderServiceConcurrencyTest', 'Testing'),

    @('Circuit breaker and fallback (incident-service)', 'The breaker wraps the call to responder-service', "incident-service/$j/incident/client/ResponderClient.java", '@CircuitBreaker(name = "responderService", fallbackMethod = "assignFallback")', 'ResponderClient.assign', 'Resilience'),
    @('Circuit breaker and fallback (incident-service)', 'The fallback: no answer means PENDING', "incident-service/$j/incident/client/ResponderClient.java", 'public Optional<AssignedResponder> assignFallback', 'ResponderClient.assignFallback', 'Resilience'),
    @('Circuit breaker and fallback (incident-service)', '409 "no responder free" is a normal answer, not a failure', "incident-service/$j/incident/client/ResponderClient.java", 'catch (HttpClientErrorException.Conflict e)', 'ResponderClient.assign', 'Resilience'),
    @('Circuit breaker and fallback (incident-service)', 'Breaker settings: opens at 50 % failures', 'incident-service/src/main/resources/application.yml', 'failure-rate-threshold: 50', 'resilience4j.circuitbreaker.instances.responderService', 'Resilience'),
    @('Circuit breaker and fallback (incident-service)', 'Timeouts make a dead service fail fast', "incident-service/$j/incident/config/RestClientConfig.java", 'factory.setReadTimeout(readTimeoutMs);', 'RestClientConfig.responderRestClient', 'Resilience'),
    @('Circuit breaker and fallback (incident-service)', 'Save first, call the remote service later (no remote call inside a DB transaction)', "incident-service/$j/incident/service/IncidentService.java", 'Incident incident = repository.save(new Incident(', 'IncidentService.create', 'Resilience'),
    @('Circuit breaker and fallback (incident-service)', 'The synchronous call itself', "incident-service/$j/incident/service/IncidentService.java", 'responderClient.assign(new AssignRequest(', 'IncidentService.tryAssign', 'Cross-service'),
    @('Circuit breaker and fallback (incident-service)', 'Test: responder hangs, fallback within 3 s', "incident-service/src/test/java/com/resqnet/incident/service/IncidentFlowTest.java", 'void responderHangs_readTimeoutTriggersFallbackWithinAboutThreeSeconds()', 'IncidentFlowTest', 'Testing'),

    @('JWT at the gateway (api-gateway)', 'Verify signature, issuer and expiry', "api-gateway/$j/gateway/security/JwtAuthenticationFilter.java", 'Jwts.parser().verifyWith(key)', 'JwtAuthenticationFilter.filter', 'Security'),
    @('JWT at the gateway (api-gateway)', 'Forged identity headers are removed', "api-gateway/$j/gateway/security/JwtAuthenticationFilter.java", 'h.remove(HEADER_ROLE);', 'JwtAuthenticationFilter.filter', 'Security'),
    @('JWT at the gateway (api-gateway)', 'The filter runs before everything else', "api-gateway/$j/gateway/security/JwtAuthenticationFilter.java", 'return Ordered.HIGHEST_PRECEDENCE;', 'JwtAuthenticationFilter.getOrder', 'Security'),
    @('JWT at the gateway (api-gateway)', 'Verified identity passed to the service', "api-gateway/$j/gateway/security/JwtAuthenticationFilter.java", '.header(HEADER_ROLE, role)', 'JwtAuthenticationFilter.filter', 'Security'),
    @('JWT at the gateway (api-gateway)', 'Services only read headers and check roles', "incident-service/$j/incident/security/CurrentUser.java", 'public void requireAdmin()', 'CurrentUser.requireAdmin', 'Security'),
    @('JWT at the gateway (api-gateway)', 'Test: expired token is rejected', "api-gateway/src/test/java/com/resqnet/gateway/security/JwtAuthenticationFilterTest.java", 'void expiredTokenIsRejected()', 'JwtAuthenticationFilterTest', 'Testing'),
    @('JWT at the gateway (api-gateway)', 'Login checks the BCrypt hash', "auth-service/$j/auth/service/AuthService.java", 'passwordEncoder.matches(request.password(), u.getPasswordHash())', 'AuthService.login', 'Security'),
    @('JWT at the gateway (api-gateway)', 'Registration always creates a USER', "auth-service/$j/auth/service/AuthService.java", 'passwordEncoder.encode(request.password()), Role.USER', 'AuthService.register', 'Security'),

    @('Service discovery and load balancing', 'The registry (Eureka server)', "discovery-service/$j/discovery/DiscoveryServiceApplication.java", '@EnableEurekaServer', 'DiscoveryServiceApplication', 'Service discovery'),
    @('Service discovery and load balancing', 'Failed GET requests are retried on another copy (smooth failover)', "api-gateway/$j/gateway/config/GatewayRoutes.java", '.setMethods(HttpMethod.GET)', 'GatewayRoutes.standardFilters', 'Handles traffic, Resilience'),
    @('Service discovery and load balancing', 'Test: GETs succeed although one copy is dead; POSTs are never repeated', "api-gateway/src/test/java/com/resqnet/gateway/config/GatewayRetryTest.java", 'void getRequestsSucceedEvenThoughOneCopyIsDead()', 'GatewayRetryTest', 'Testing'),
    @('Service discovery and load balancing', 'Gateway gives up on a dead copy after 1 s', 'api-gateway/src/main/resources/application.yml', 'connect-timeout: 1000', 'application.yml (httpclient)', 'Resilience'),
    @('Service discovery and load balancing', 'Gateway routes by service NAME, not address', "api-gateway/$j/gateway/config/GatewayRoutes.java", '.uri("lb://incident-service"))', 'GatewayRoutes.routes', 'Service discovery, Handles traffic'),
    @('Service discovery and load balancing', 'incident-service finds responder-service by name', "incident-service/$j/incident/config/RestClientConfig.java", '@LoadBalanced', 'RestClientConfig.loadBalancedRestClientBuilder', 'Service discovery'),
    @('Service discovery and load balancing', 'Every service registers with Eureka', 'incident-service/src/main/resources/application.yml', 'defaultZone: ${EUREKA_URL:http://localhost:8761/eureka}', 'application.yml (eureka.client)', 'Service discovery'),
    @('Service discovery and load balancing', 'Two copies of incident-service', 'k8s/21-incident.yaml', 'replicas: 2', 'Deployment incident-service', 'Handles traffic'),
    @('Service discovery and load balancing', 'Which pod answered (load-balancing evidence)', "incident-service/$j/incident/config/ServedByFilter.java", 'response.setHeader("X-Served-By", instanceName);', 'ServedByFilter.doFilterInternal', 'Handles traffic'),

    @('Asynchronous event (RabbitMQ)', 'Publish to the exchange', "incident-service/$j/incident/messaging/IncidentEventPublisher.java", 'rabbitTemplate.convertAndSend(RabbitConfig.EXCHANGE, routingKey, event);', 'IncidentEventPublisher.publish', 'Cross-service'),
    @('Asynchronous event (RabbitMQ)', 'Exchange, queue and binding (declared in code)', "incident-service/$j/incident/messaging/RabbitConfig.java", 'BindingBuilder.bind(notificationQueue).to(eventsExchange).with("incident.*");', 'RabbitConfig.notificationBinding', 'Cross-service'),
    @('Asynchronous event (RabbitMQ)', 'The consumer', "notification-service/$j/notification/messaging/IncidentEventListener.java", '@RabbitListener(queues = RabbitConfig.QUEUE)', 'IncidentEventListener.onIncidentEvent', 'Cross-service'),
    @('Asynchronous event (RabbitMQ)', 'Idempotent consumer: skip a known eventId', "notification-service/$j/notification/service/NotificationService.java", 'if (repository.existsByEventId(notification.getEventId()))', 'NotificationService.recordEvent', 'Cross-service'),
    @('Asynchronous event (RabbitMQ)', 'Unique event_id column (second line of defence)', "notification-service/$j/notification/model/Notification.java", '@Column(name = "event_id", nullable = false, unique = true)', 'Notification.eventId', 'Database'),
    @('Asynchronous event (RabbitMQ)', 'Test: the same event never creates two notifications', "notification-service/src/test/java/com/resqnet/notification/service/NotificationServiceTest.java", 'void duplicateEventIdDoesNotCreateASecondNotification()', 'NotificationServiceTest', 'Testing'),

    @('Database per service', 'Four users, each connects only to its own database', 'db/init-databases.sh', 'REVOKE CONNECT ON DATABASE', 'init-databases.sh', 'Database'),
    @('Database per service', 'incident-service uses only its own database', 'k8s/21-incident.yaml', 'jdbc:postgresql://postgres:5432/incident_db', 'Deployment incident-service (env)', 'Database'),

    @('Docker and Kubernetes', 'Image: Java runtime plus the jar', 'auth-service/Dockerfile', 'FROM eclipse-temurin:17-jre', 'Dockerfile', 'Deployed'),
    @('Docker and Kubernetes', 'Wait for Postgres before starting (init container)', 'k8s/22-responder.yaml', 'name: wait-for-postgres', 'Deployment responder-service', 'Deployed'),
    @('Docker and Kubernetes', 'Readiness probe: only receive traffic when healthy', 'k8s/22-responder.yaml', 'readinessProbe:', 'Deployment responder-service', 'Deployed'),
    @('Docker and Kubernetes', 'Only the gateway is reachable from outside', 'k8s/30-gateway.yaml', 'type: NodePort', 'Service api-gateway', 'Deployed, Security'),
    @('Docker and Kubernetes', 'Images are copied into Minikube (containerd runtime)', 'scripts/deploy-minikube.ps1', 'minikube image load $image', 'deploy-minikube.ps1', 'Deployed')
)

$byTopic = [ordered]@{}
foreach ($e in $entries) {
    $topic, $concept, $file, $snippet, $where, $row = $e
    $full = Join-Path $root $file
    if (-not (Test-Path $full)) { throw "File not found: $file" }
    $hits = @(Select-String -Path $full -SimpleMatch -Pattern $snippet)
    if ($hits.Count -eq 0) { throw "Snippet not found in ${file}: $snippet" }
    if (-not $byTopic.Contains($topic)) { $byTopic[$topic] = New-Object System.Collections.Generic.List[string] }
    $byTopic[$topic].Add(('| {0} | `{1}:{2}` | `{3}` | {4} | {5} |' -f $concept, $file, $hits[0].LineNumber, $snippet, $where, $row))
}

$out = New-Object System.Text.StringBuilder
[void]$out.AppendLine('# Code references (generated)')
[void]$out.AppendLine('')
[void]$out.AppendLine('Every row gives the file, the exact line number and the code snippet found there, so you can open the file and point at it during the viva.')
[void]$out.AppendLine('')
[void]$out.AppendLine('- Generated from the real source by `scripts/generate-references.ps1` (line numbers are never typed by hand).')
[void]$out.AppendLine('- Checked by `scripts/verify-references.ps1`: each snippet must really be at its line. If you edit code, run both scripts again.')
[void]$out.AppendLine('- Line numbers can shift after edits; the class and method names in the fourth column stay valid.')
foreach ($topic in $byTopic.Keys) {
    [void]$out.AppendLine('')
    [void]$out.AppendLine("## $topic")
    [void]$out.AppendLine('')
    [void]$out.AppendLine('| Concept | File:line | Snippet | Class / method | Rubric row |')
    [void]$out.AppendLine('|---|---|---|---|---|')
    foreach ($row in $byTopic[$topic]) { [void]$out.AppendLine($row) }
}
New-Item -ItemType Directory -Force (Join-Path $root 'docs\viva') | Out-Null
$target = Join-Path $root 'docs\viva\CODE_REFERENCES.md'
[IO.File]::WriteAllText($target, $out.ToString(), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Wrote $target ($($entries.Count) references)" -ForegroundColor Green
