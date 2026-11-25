# Spring Boot Microservices Lab Project

## 10-Hour Autonomous Development, Testing, Kubernetes, Free Public Deployment, Documentation and Viva Preparation

Hey Claude!

I have a Microservices Lab project to complete as part of my college
curriculum. I need to build a project using Java and Spring Boot,
implement the required microservices concepts, containerize the
application using Docker, deploy it using Kubernetes, and host the
application publicly so other people can access it through a URL.

I have **exactly 10 hours** to complete the entire project, including
development, testing, deployment, diagrams, documentation, and viva
preparation.

I will provide a document containing the official project rubrics,
requirements, and mandatory components.

I want you to act as my software architect, Spring Boot developer,
microservices mentor, Docker and Kubernetes engineer, tester, deployment
engineer, technical writer, and viva preparation mentor.

Your responsibility is to take ownership of the technical implementation
and help me finish the project.

**The final result must be a good-quality, easy-to-medium complexity,
thoroughly tested, Kubernetes-demonstrated, publicly accessible
application that satisfies the college rubric and costs absolutely ₹0.**

I also need to understand the entire project well enough to explain it
confidently to a professor after approximately 2--3 hours of focused
study.

Do not spend time on endless planning or lengthy theoretical
discussions. Analyze, decide, implement, test, debug, document, deploy,
and prepare me for evaluation.

------------------------------------------------------------------------

# 1. Permission and Access Preflight --- Do This Before Starting Work

**Before analyzing, creating files, installing software, running
commands, changing configurations, connecting accounts, or performing
any implementation work, first identify and request every permission,
access grant, account connection, and user action you will need.**

I may be busy and unable to respond during development. I want to grant
the necessary permissions up front so you can complete the project in
one continuous execution without repeatedly interrupting me.

At the very beginning:

1.  Inspect which tools and capabilities are actually available to you.
2.  Identify whether you have access to a terminal, filesystem, project
    folder, Git, GitHub, Docker, Kubernetes, browser, and hosting
    platforms.
3.  Identify every account connection or authorization that may be
    needed.
4.  Identify any local setup or installation that requires my
    involvement.
5.  Identify any deployment step that requires an account, verification,
    domain, token, or explicit confirmation.
6.  Present one consolidated permission and access checklist before
    starting implementation.
7.  Tell me exactly what I need to grant, connect, install, or
    authorize.
8.  Where supported, request all required permissions and connections up
    front.

**Do not begin project work until this permission/access preflight has
been completed and I have had the opportunity to grant the required
access.**

Do not assume that this prompt itself grants access to accounts, tools,
devices, or external services.

Once I have granted the available permissions, proceed autonomously with
all routine and authorized project work. Do not repeatedly ask for
permission for ordinary development actions already covered by the
granted access.

You may perform authorized routine actions such as:

-   Create and modify project files.
-   Install necessary development dependencies.
-   Run builds and tests.
-   Start local applications.
-   Build Docker images.
-   Create and apply local Kubernetes manifests.
-   Generate diagrams and documentation.
-   Debug and fix errors.
-   Prepare Git commits.
-   Push to an authorized repository.
-   Configure free hosting where the required access has been granted.

However:

-   Never incur costs.
-   Never activate paid resources.
-   Never subscribe to paid services.
-   Never enable billing or create billable infrastructure.
-   Never expose credentials.
-   Never commit secrets.
-   Never delete unrelated files or repositories.
-   Never bypass authentication, account security, or provider
    safeguards.
-   Never perform irreversible or externally consequential actions that
    require explicit confirmation without obtaining it.

If an action requires an additional confirmation that cannot be granted
in advance, identify it during the preflight. If it becomes necessary
later, pause only that action, explain exactly what is needed, and
continue with independent tasks.

If I am unavailable, continue all independent tasks that do not require
my intervention. Maintain a concise list of anything blocked by my
input.

------------------------------------------------------------------------

# 2. Analyze the Official Rubric

I will upload the official project rubric.

Read the entire document carefully.

Identify:

1.  Every mandatory requirement.
2.  Required Spring Boot concepts.
3.  Required microservices concepts.
4.  Required architectural components.
5.  Required technologies.
6.  Docker requirements.
7.  Kubernetes requirements.
8.  Application testing requirements.
9.  Deployment requirements.
10. Evaluation criteria.
11. Expected submission deliverables.

Create a compliance checklist mapping every rubric requirement to the
exact feature, service, configuration, test, or document that will
satisfy it.

The rubric is our primary source of truth. Do not overlook mandatory
requirements or invent requirements that are not present.

If a requirement is ambiguous, briefly explain your interpretation and
choose the simplest implementation that is consistent with the rubric.

------------------------------------------------------------------------

# 3. Choose the Project Topic Yourself --- Do Not Wait for Me

After analyzing the rubric, evaluate approximately 3--5 suitable project
ideas.

For each idea, briefly explain:

-   What the application does.
-   What problem it solves.
-   Which microservices it contains.
-   Which technologies and concepts it demonstrates.
-   Its complexity.
-   Its feasibility within 10 hours.
-   How well it satisfies the rubric.
-   How easily I can explain it during a viva.

Then **YOU MUST SELECT THE BEST PROJECT YOURSELF.**

-   Do not wait for me to choose a topic.
-   Do not ask me which project I prefer.
-   Do not wait for my approval of the topic.
-   Do not repeatedly present alternatives and leave the decision to me.

Choose based on rubric compliance, implementation simplicity,
demonstration value, Kubernetes suitability, zero-cost deployment
feasibility, and the 10-hour deadline.

Tell me the selected topic and briefly explain why it is the best
choice. Then move directly into implementation.

------------------------------------------------------------------------

# 4. Project Complexity and Quality

I want an **easy-to-medium complexity project**.

It must be meaningful enough to score well in a college lab evaluation,
but not unnecessarily ambitious.

The project should demonstrate:

-   Genuine microservices architecture.
-   Multiple independently functioning services.
-   Actual inter-service communication.
-   Database integration.
-   Meaningful business logic.
-   REST API development.
-   Docker containerization.
-   Kubernetes orchestration.
-   Testing.
-   Public deployment.

Prefer approximately 3--4 microservices if the rubric permits. Do not
create excessive services or features merely to make the project look
sophisticated.

Avoid a trivial beginner CRUD application, but keep the business
workflow focused and achievable.

**The goal is a good project with medium-level functionality and
beginner-friendly implementation.**

------------------------------------------------------------------------

# 5. Coding Philosophy --- Highest Priority

The code must be **very simple, readable, and understandable**.

Follow these rules:

1.  Use straightforward Java.
2.  Follow standard Spring Boot conventions.
3.  Add useful comments wherever possible.
4.  Explain important annotations.
5.  Use meaningful class, method, and variable names.
6.  Keep methods short and focused.
7.  Avoid complicated design patterns.
8.  Avoid unnecessary abstraction.
9.  Avoid excessive interfaces and classes.
10. Avoid overengineering.
11. Avoid unnecessary dependencies.
12. Avoid complicated configurations.
13. Avoid advanced techniques unless the rubric requires them.

Comments should explain intent and important logic, not merely repeat
the code.

For every important class, explain what it does. For every important
method, explain its purpose. For every important annotation, explain why
it is used.

I should be able to understand the complete codebase without advanced
Java or Spring Boot knowledge.

**Target: medium-level application functionality with beginner-friendly
code.**

------------------------------------------------------------------------

# 6. Preferred Technology Stack

Use the following where appropriate, unless the rubric specifies
otherwise.

## Backend

-   Java.
-   Spring Boot.
-   Spring Web.
-   Spring Data JPA.
-   Maven.
-   REST APIs.

## Database

-   MySQL or PostgreSQL.

## Microservices

-   Spring Cloud components where appropriate.
-   API Gateway if required or useful.
-   Service Discovery if required or useful.
-   REST-based inter-service communication.

## Containerization

-   Docker.
-   Dockerfiles.
-   Docker images.

## Orchestration

-   Kubernetes.
-   Deployments.
-   Services.
-   ConfigMaps.
-   Secrets.
-   Ingress or an appropriate external access mechanism.
-   Persistent Volumes and Claims where required.

## Version control

-   Git.
-   GitHub.

Only introduce technologies that serve a genuine purpose or are required
by the rubric. Verify compatibility across all technology versions and
dependencies.

------------------------------------------------------------------------

# 7. Architecture and System Design

After selecting the project, prepare:

1.  Project title.
2.  Problem statement.
3.  Objectives.
4.  Main features.
5.  Microservices list.
6.  Responsibility of each service.
7.  Database design.
8.  API endpoint list.
9.  Inter-service communication design.
10. Overall system architecture.
11. Docker architecture.
12. Kubernetes architecture.
13. Public deployment architecture.
14. Data flow.
15. Important end-to-end workflows.

Keep the architecture technically correct, realistic, and easy to
explain.

Each microservice must have a meaningful responsibility. Services must
actually communicate with each other. Do not simply create different
packages in one Spring Boot application and call them microservices.

------------------------------------------------------------------------

# 8. Immediate Implementation

After the permission preflight has been completed, the rubric analyzed,
and the topic independently selected, **start implementing
immediately**.

Do not wait for me to approve the topic or architecture.

For every file:

-   Give its exact path.
-   Create the actual file if filesystem access is available.
-   Provide complete, runnable code.
-   Add useful comments.
-   Explain its purpose briefly.
-   Explain how it connects to other components.
-   Provide the exact command to execute.
-   Verify the result.

Maintain a clean project structure. Do not provide disconnected
snippets, assume files already exist, skip required configuration files,
or leave mandatory features as placeholders.

Use terminal and filesystem access actively wherever available. If you
cannot access my local environment, provide exact commands and ask for
the relevant output when necessary.

------------------------------------------------------------------------

# 9. Dependency and Version Compatibility

Verify compatibility across:

-   Java version.
-   Spring Boot version.
-   Spring Cloud version.
-   Maven dependencies.
-   Database drivers.
-   Third-party libraries.
-   Docker configuration.
-   Kubernetes configuration.

Avoid conflicting or unnecessary dependencies.

Run Maven builds throughout development, for example:

``` bash
mvn clean install
mvn test
```

Resolve dependency and compilation errors before moving forward. Do not
claim a build succeeds unless you actually execute it and inspect the
result.

------------------------------------------------------------------------

# 10. Two Separate Testing Responsibilities --- Both Mandatory

When I say testing, I mean **two distinct categories of testing**. Do
not confuse them or treat one as a substitute for the other.

## A. Application Testing

This verifies that the software itself works correctly.

Test continuously while building, not only at the end.

After implementing each microservice:

1.  Resolve dependencies.
2.  Compile the application.
3.  Start the application.
4.  Inspect startup logs.
5.  Verify successful startup.
6.  Test REST endpoints.
7.  Verify database connectivity.
8.  Test expected responses.
9.  Test invalid requests.
10. Fix discovered errors.

Perform the following as applicable:

### Unit testing

Use JUnit and Mockito to test individual business logic and methods.

### Integration testing

Verify that application components work together correctly.

### API testing

Use Postman, curl, or an appropriate automated API-testing tool.

### Inter-service communication testing

Verify that services actually communicate and handle responses and
failures correctly.

### Database testing

Test connectivity, CRUD operations, persistence, validation, and
relationships.

### End-to-end testing

Test complete user workflows across the frontend/API entry point,
microservices, and database.

### Negative testing

Test invalid inputs, missing fields, nonexistent records, duplicate
data, and expected error responses.

### Docker testing

Verify image builds, container startup, networking, and service
connectivity.

### Kubernetes testing

Verify pods, deployments, services, configuration, health checks, and
application connectivity.

### Public deployment testing

Open the actual public URL and test real application functionality from
the deployed environment.

Do not merely generate test files. Execute the tests wherever the
environment permits.

Report: - What was tested. - Which test or command was executed. -
Expected result. - Actual result. - Pass/fail status. - Bugs
discovered. - Fixes applied.

## B. Script and Documentation Testing

This is a separate mandatory responsibility.

The project will contain scripts and instructions that I must use during
my college demonstration and viva. These include:

-   Viva script.
-   User manual.
-   Demonstration script.
-   Quick revision sheet.
-   Setup instructions.
-   Docker instructions.
-   Kubernetes instructions.
-   Testing instructions.
-   Any shell scripts, helper scripts, or automation scripts created for
    the project.

**You must test these scripts and instructions themselves.**

Do not assume that documentation is correct merely because it has been
written.

For every executable script:

1.  Verify its syntax.
2.  Check its file paths.
3.  Check its dependencies.
4.  Verify its commands.
5.  Execute it in a safe test environment where possible.
6.  Check its exit status.
7.  Verify its output.
8.  Fix errors.
9.  Re-run it after fixes.

For every human-followed instruction document:

1.  Follow the instructions from beginning to end.
2.  Pretend you are a first-time user who has never seen the project.
3.  Verify every URL, command, file path, filename, and referenced
    feature.
4.  Verify that the described buttons, screens, and workflows actually
    exist.
5.  Verify that sample inputs produce the documented outputs.
6.  Verify that referenced classes and methods exist.
7.  Verify all stated line numbers against the final source files.
8.  Correct inaccurate or ambiguous instructions.
9.  Repeat the walkthrough after making corrections.

### Script testing versus application testing

Keep separate results for these two categories in the final report.

For example:

  -----------------------------------------------------------------------
  Testing category                    What it verifies
  ----------------------------------- -----------------------------------
  Application testing                 The application, APIs, database,
                                      services, Docker, Kubernetes, and
                                      public deployment work

  Script/documentation testing        The viva script, demo instructions,
                                      user manual, commands, helper
                                      scripts, file references, line
                                      numbers, and documented workflows
                                      are correct
  -----------------------------------------------------------------------

A successful application test does not mean the demonstration script is
correct.

A successful documentation review does not mean the application works.

**Both categories must be independently verified.**

Do not claim a script or document has been tested unless you actually
followed or executed it. If a step cannot be tested because it requires
my account or physical interaction, mark it as not independently
verified and tell me exactly how I can verify it.

------------------------------------------------------------------------

# 11. Docker --- Mandatory

Containerize all required microservices.

Create:

-   A Dockerfile for each required service.
-   Appropriate image tags.
-   Correct container ports.
-   Environment variable configuration.
-   Database connection configuration.
-   Inter-service connection configuration.

Build and test the Docker images.

Use Docker Compose for local integration testing where appropriate.

Verify image builds, container startup, service communication, and
database connectivity.

Keep Dockerfiles simple and explainable.

------------------------------------------------------------------------

# 12. Kubernetes --- Mandatory

Kubernetes is compulsory and must be part of the original architecture.

Implement actual Kubernetes resources using YAML manifests.

Include the following wherever appropriate:

1.  Deployment for each microservice.
2.  Kubernetes Services.
3.  ConfigMaps.
4.  Secrets.
5.  Ingress or an appropriate external access mechanism.
6.  Persistent Volumes and Claims if needed.
7.  Readiness probes.
8.  Liveness probes.
9.  Appropriate replica configurations.

Use simple, understandable YAML files.

Evaluate Minikube, Kind, and genuinely free managed Kubernetes options.
Choose based on the 10-hour deadline and zero-cost requirement.

Verify actual deployment using commands such as:

``` bash
kubectl get nodes
kubectl get pods -A
kubectl get deployments
kubectl get services
kubectl get configmaps
kubectl get secrets
kubectl get ingress
```

Inspect logs and troubleshoot errors.

Verify: - Cluster connectivity. - Pod creation. - Deployment status. -
Service discovery. - Inter-service communication. - Database
connectivity. - Configuration. - Application health. - External
access. - Restart behavior.

Do not simply generate YAML files and claim Kubernetes is complete.
Apply the manifests and verify the actual resources.

------------------------------------------------------------------------

# 13. Public Hosting --- Strict ₹0 Budget

When I say deployment, I mean the actual application must be hosted on
the internet.

I want a public URL that other people can access from their devices.

Localhost, Docker Compose, Minikube, and Kind alone do not satisfy this
public-hosting requirement.

The application should have:

-   A public URL.
-   HTTPS wherever supported.
-   A working frontend or public API entry point.
-   Functional backend services.
-   Working database connectivity.
-   Working inter-service communication.
-   A demonstrable application workflow.

**The entire project must cost ₹0.**

Do not recommend paid hosting, paid Kubernetes, paid databases, expiring
trials, or services that may unexpectedly generate charges.

Investigate genuinely free hosting options. Evaluate current pricing,
free-tier limitations, eligibility, RAM, CPU, storage, Docker support,
database persistence, networking, and billing requirements.

Consider providers such as Render, Koyeb, Oracle Cloud Always Free, and
other suitable providers, but verify their current terms rather than
assuming they are free.

Do not activate paid resources or enable billing. If a credit card or
billing account is required, inform me before proceeding. Do not mistake
trial credits for permanent free hosting.

## Public Hosting and Kubernetes

We need both:

1.  A genuine Kubernetes implementation.
2.  A publicly accessible application.

Investigate whether both can run in the same genuinely free environment.

If not, implement a practical hybrid architecture:

-   Publicly host the application using a genuinely free service.
-   Demonstrate Kubernetes orchestration using Minikube or Kind.
-   Reuse the same source code and Docker images wherever practical.
-   Clearly document which environment hosts the public application and
    which demonstrates Kubernetes.

Never claim that the public application is Kubernetes-hosted if it is
not.

Verify and report the actual total cost as ₹0. Explain any free-tier
limitations, such as sleeping services, quotas, or temporary database
storage.

------------------------------------------------------------------------

# 14. Viva Script --- Mandatory Deliverable

Create a dedicated documentation folder containing all materials needed
for my college evaluation.

Suggested structure:

``` text
project/
└── documentation/
    ├── viva/
    ├── demonstration/
    ├── architecture/
    └── diagrams/
```

Create:

``` text
documentation/viva/VIVA_SCRIPT.md
```

This must be a complete script I can follow during my evaluation.

Do not merely provide a list of questions and answers. Write it as
though you are personally teaching a student who has never used the
application.

## A. Introduction script

Give me natural, simple answers to:

-   What is your project?
-   What problem does it solve?
-   Why did you choose this project?
-   What technologies did you use?
-   Why did you use microservices?
-   What are the main features?

## B. Complete application demonstration

Explain:

1.  How to open the application.
2.  Which URL to visit.
3.  What credentials or sample data to use, if applicable.
4.  Which buttons to click.
5.  What information to enter.
6.  What output to expect.
7.  How to demonstrate every major feature.
8.  How to demonstrate a complete workflow.
9.  What happens behind the scenes.

Include sample inputs and expected outputs.

Make the instructions clear enough to follow during an evaluation
without guessing.

## C. Technical walkthrough

For every important file, document:

-   Exact file path.
-   Filename.
-   Purpose.
-   Important classes.
-   Important methods.
-   Important annotations.
-   Important configuration.
-   How the file connects to other files.
-   Which rubric requirement or project feature it implements.

Explain the controller, service, repository, model/entity,
configuration, and other layers actually used in the project.

## D. Exact source-code references

For important concepts, provide:

-   File path.
-   Class name.
-   Method name.
-   Exact line number or line range.
-   What the code does.
-   How to explain it to the professor.

Use the actual final source files.

**Never invent line numbers.**

If code changes, update the documentation. Use file paths, class names,
and method names alongside line numbers so references remain
understandable.

## E. Microservices explanation

Explain:

-   Why each microservice exists.
-   What each service does.
-   How they communicate.
-   Which service calls which.
-   What happens when a request arrives.
-   How data moves between services.
-   How database operations work.

Provide a complete request-flow explanation.

## F. Docker and Kubernetes viva

Prepare simple explanations for:

-   Dockerfile.
-   Docker image.
-   Docker container.
-   Kubernetes.
-   Pod.
-   Deployment.
-   Service.
-   ConfigMap.
-   Secret.
-   Ingress.
-   Persistent Volume, if used.
-   How the application was deployed.
-   How to inspect pods and logs.
-   How to restart a deployment.

Provide exact commands that I can execute during the demonstration.

## G. Likely viva questions

Prepare approximately 30--50 relevant questions with simple answers.

Cover Java, Spring Boot, REST APIs, microservices, database, Docker,
Kubernetes, testing, deployment, and our actual implementation.

Prioritize questions a professor is likely to ask about the actual code.

## H. Quick revision sheet

Create:

``` text
documentation/viva/QUICK_REVISION.md
```

Include: - Project overview. - Architecture summary. - Microservices and
responsibilities. - Important annotations. - Important files. - API
endpoints. - Docker commands. - Kubernetes commands. - Database
details. - Key talking points. - Common viva questions.

Make it useful for last-minute revision.

------------------------------------------------------------------------

# 15. User Manual and Demonstration Guide

Create:

``` text
documentation/demonstration/USER_MANUAL.md
documentation/demonstration/DEMO_SCRIPT.md
```

## USER_MANUAL.md

Write for a completely non-technical first-time user.

Explain:

1.  What the application is.
2.  How to access it.
3.  How to navigate the interface.
4.  How to use every major feature.
5.  Example workflows.
6.  Sample inputs.
7.  Expected outputs.
8.  Common errors.
9.  How to recover from errors.

## DEMO_SCRIPT.md

Create a timed presentation script for my college evaluation.

For each step, include:

-   What to open.
-   What to click.
-   What to enter.
-   What happens.
-   What to say to the professor.
-   Which technical component is responsible.
-   Which source file implements that functionality.

The demonstration should be natural, practical, and easy to follow.

------------------------------------------------------------------------

# 16. Architecture Diagrams and PNG Visual Documentation

Generate actual PNG diagrams and store them in:

``` text
documentation/diagrams/
```

Create all useful diagrams needed to explain and present the project.

At minimum, create the following where relevant:

1.  High-level system architecture.
2.  Microservices architecture.
3.  Request lifecycle diagram.
4.  Data flow diagram.
5.  Database ER diagram.
6.  UML component diagram.
7.  UML sequence diagram for an important workflow.
8.  Docker architecture diagram.
9.  Kubernetes architecture diagram.
10. Public deployment architecture diagram.
11. Complete project workflow diagram.
12. CI/CD pipeline diagram, if CI/CD is implemented.

Use accurate labels, readable text, consistent visual styling, and clear
arrows.

Diagrams must match the actual implementation. Do not include components
that were never built.

Create editable source files where practical, such as Mermaid or
PlantUML.

Suggested filenames:

``` text
documentation/diagrams/
├── 01-system-architecture.png
├── 02-microservices-architecture.png
├── 03-request-lifecycle.png
├── 04-data-flow.png
├── 05-database-er-diagram.png
├── 06-component-diagram.png
├── 07-sequence-diagram.png
├── 08-docker-architecture.png
├── 09-kubernetes-architecture.png
├── 10-public-deployment-architecture.png
├── 11-project-workflow.png
└── sources/
```

Generate diagrams that genuinely help explain the system, not merely
decorative images.

------------------------------------------------------------------------

# 17. Final Project Documentation

Maintain a clean documentation structure, adapting it to the actual
project:

``` text
project/
├── services/
├── docker/
├── kubernetes/
├── documentation/
│   ├── viva/
│   │   ├── VIVA_SCRIPT.md
│   │   └── QUICK_REVISION.md
│   ├── demonstration/
│   │   ├── USER_MANUAL.md
│   │   └── DEMO_SCRIPT.md
│   ├── architecture/
│   │   └── SYSTEM_DESIGN.md
│   └── diagrams/
│       ├── PNG diagrams
│       └── sources/
├── README.md
└── docker-compose.yml
```

The main README must include:

-   Project overview.
-   Problem statement.
-   Features.
-   Technology stack.
-   Architecture.
-   Setup instructions.
-   Testing instructions.
-   Docker instructions.
-   Kubernetes instructions.
-   Public deployment URL.
-   Links to diagrams and documentation.

Ensure all paths and references are correct.

------------------------------------------------------------------------

# 18. Final Quality Assurance --- Test the Application AND the Scripts

Perform a complete quality assurance pass after implementation.

## Application quality assurance

Verify:

-   All files compile.
-   No missing classes or incorrect packages.
-   No broken imports.
-   Dependencies resolve.
-   Maven builds succeed.
-   All major features work.
-   API endpoints work.
-   Database operations work.
-   Inter-service communication works.
-   Error handling works.
-   Docker images build.
-   Containers run.
-   Kubernetes manifests are valid.
-   Pods and deployments are healthy.
-   Public URL works.
-   Main public workflows work.

## Script and documentation quality assurance

Verify separately:

-   Shell scripts have valid syntax.
-   Helper scripts execute correctly.
-   Commands are accurate.
-   File paths exist.
-   Referenced classes and methods exist.
-   Line numbers match the final code.
-   URLs work.
-   Sample inputs produce documented outputs.
-   User manual steps match the real interface.
-   Viva demonstration steps work.
-   Kubernetes commands match the actual deployment.
-   Diagrams match the implemented architecture.

Follow the complete USER_MANUAL.md and DEMO_SCRIPT.md from beginning to
end as if you were a first-time user.

Correct mistakes and repeat the walkthrough.

**An application passing its tests does not mean its demonstration
script has passed testing. Report these two categories separately.**

If a step cannot be independently verified, clearly mark it as
unverified and explain how I can verify it.

------------------------------------------------------------------------

# 19. CI/CD --- Optional, Do Last

Postpone CI/CD until the mandatory project work is complete.

Priority:

1.  Rubric compliance.
2.  Application development.
3.  Docker.
4.  Kubernetes.
5.  Application testing.
6.  Public hosting.
7.  Script and documentation testing.
8.  Diagrams.
9.  Viva preparation.
10. CI/CD if time remains.

If time permits, implement a simple GitHub Actions pipeline for:

-   Checkout.
-   Java setup.
-   Maven build.
-   Automated tests.
-   Docker image build.
-   Deployment automation if feasible.

Do not sacrifice mandatory requirements for CI/CD.

------------------------------------------------------------------------

# 20. Strict 10-Hour Execution Schedule

Use this initial schedule and adjust it based on the rubric:

  Phase                                                       Time
  ------------------------------------------------- --------------
  Permission/access preflight and rubric analysis           30 min
  Topic selection, architecture, and setup                  30 min
  Spring Boot microservices implementation             2 hr 15 min
  Docker containerization                                   45 min
  Kubernetes implementation                            1 hr 30 min
  Application integration and testing                         1 hr
  Public hosting and verification                             1 hr
  Documentation, diagrams, and viva materials          1 hr 30 min
  Final application and script QA                             1 hr
  **TOTAL**                                           **10 HOURS**

Testing must happen continuously throughout development. The allocated
testing and QA time is for integration and final verification, not the
only time testing occurs.

If we fall behind:

-   Simplify nonessential features.
-   Remove unnecessary complexity.
-   Prioritize mandatory rubric requirements.
-   Protect Kubernetes and public hosting time.
-   Preserve final quality assurance time.

Do not remove mandatory requirements without informing me.

------------------------------------------------------------------------

# 21. Progress Tracking

Maintain this checklist throughout development:

-   [ ] Permission and access preflight completed.
-   [ ] Required permissions granted or blockers documented.
-   [ ] Rubric analyzed.
-   [ ] Mandatory requirements identified.
-   [ ] Topic independently selected.
-   [ ] Architecture designed.
-   [ ] Microservices implemented.
-   [ ] Database integrated.
-   [ ] Inter-service communication tested.
-   [ ] Dependencies verified.
-   [ ] Maven builds successful.
-   [ ] Unit tests executed.
-   [ ] Integration tests executed.
-   [ ] API tests executed.
-   [ ] End-to-end tests executed.
-   [ ] Docker images built.
-   [ ] Docker containers tested.
-   [ ] Kubernetes manifests created.
-   [ ] Kubernetes deployment verified.
-   [ ] Public hosting configured.
-   [ ] Public URL verified.
-   [ ] Zero-cost requirement checked.
-   [ ] Public application tested.
-   [ ] PNG diagrams generated.
-   [ ] Editable diagram sources saved.
-   [ ] Viva script created.
-   [ ] User manual created.
-   [ ] Demonstration script created.
-   [ ] Quick revision sheet created.
-   [ ] File and line references verified.
-   [ ] Executable scripts tested.
-   [ ] Human-followed instructions tested.
-   [ ] README completed.
-   [ ] Final application QA completed.
-   [ ] Final script/documentation QA completed.
-   [ ] CI/CD implemented if time permits.

After each major phase, report: - What is complete. - What has been
tested. - Application test results. - Script/documentation test
results. - Errors discovered and fixed. - What remains. - Whether we are
on schedule.

Only mark an item complete after verification.

------------------------------------------------------------------------

# 22. How You Must Start

Follow this sequence:

**STEP 1:** Complete the permission and access preflight. Identify and
request all required permissions and connections before starting project
work.

**STEP 2:** Read the uploaded rubric.

**STEP 3:** Identify all mandatory requirements and create the
compliance checklist.

**STEP 4:** Evaluate 3--5 suitable project ideas.

**STEP 5:** Independently select the best project. Do not wait for me to
choose or approve it.

**STEP 6:** Present the selected topic and architecture briefly.

**STEP 7:** Start implementing immediately.

**STEP 8:** Test each application component as it is developed.

**STEP 9:** Containerize using Docker.

**STEP 10:** Implement and verify Kubernetes.

**STEP 11:** Host the actual application publicly for ₹0.

**STEP 12:** Perform application integration and end-to-end testing.

**STEP 13:** Generate PNG diagrams and editable diagram sources.

**STEP 14:** Create the viva script, user manual, demonstration guide,
and quick revision sheet.

**STEP 15:** Test the executable scripts and manually follow every
demonstration/documentation workflow.

**STEP 16:** Verify every file reference and line number against the
final code.

**STEP 17:** Prepare GitHub and README.

**STEP 18:** Implement CI/CD if time permits.

**STEP 19:** Perform final application QA and script/documentation QA
separately.

------------------------------------------------------------------------

# FINAL DELIVERABLE

At the end of 10 hours, I expect:

1.  A functional Spring Boot microservices application.
2.  Full compliance with the official rubric.
3.  Easy-to-understand, well-commented code.
4.  Compatible dependencies and successful builds.
5.  Working database integration.
6.  Genuine inter-service communication.
7.  Dockerized services.
8.  Kubernetes manifests and a verified Kubernetes demonstration.
9.  A real publicly accessible application URL.
10. Zero expenditure.
11. Executed unit, integration, API, and end-to-end tests.
12. A clean GitHub repository.
13. Professional README.
14. Complete system architecture documentation.
15. Multiple actual PNG architecture and workflow diagrams.
16. Editable diagram source files.
17. A detailed viva script.
18. A non-technical user manual.
19. A step-by-step demonstration script.
20. A quick revision sheet.
21. A technical code walkthrough with exact file paths and verified line
    numbers.
22. Likely viva questions and answers.
23. Independently tested executable scripts.
24. Independently tested human-followed documentation and demonstration
    instructions.
25. Completed final quality assurance.
26. CI/CD if time permits.

# MOST IMPORTANT OBJECTIVE

Imagine I have only 2--3 hours to study the completed project before
standing in front of a professor.

The architecture, code, comments, diagrams, documentation, and viva
preparation must make that possible.

I should be able to explain the project from the user interface all the
way down to the database, microservices, Docker containers, and
Kubernetes deployment.

The application must work, and the scripts I use to demonstrate it must
also work.

**10 HOURS. ₹0 COST. SIMPLE CODE. GOOD PROJECT. DOCKER. KUBERNETES.
PUBLIC HOSTING. APPLICATION TESTING. SCRIPT TESTING. COMPLETE VIVA
PREPARATION.**

First complete the permission and access preflight. Then analyze the
rubric, independently select the best topic, and start implementing
without waiting for me to choose a topic.

Take ownership of the project and finish it as one coordinated effort.
