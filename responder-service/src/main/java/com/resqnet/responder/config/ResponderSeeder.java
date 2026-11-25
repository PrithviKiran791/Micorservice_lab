package com.resqnet.responder.config;

import com.resqnet.responder.model.Responder;
import com.resqnet.responder.model.ResponderType;
import com.resqnet.responder.repository.ResponderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Inserts the 9 demo responders (3 per type) on start-up, only when the table is empty,
 * so restarts never duplicate them (rule R-DB-5). Three per type makes it easy to run out
 * live: the 4th MEDICAL incident becomes PENDING.
 */
@Component
public class ResponderSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ResponderSeeder.class);

    private final ResponderRepository repository;

    public ResponderSeeder(ResponderRepository repository) {
        this.repository = repository;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (repository.count() > 0) {
            return;
        }
        repository.saveAll(List.of(
                new Responder("Ambulance Alpha", ResponderType.AMBULANCE, "North"),
                new Responder("Ambulance Bravo", ResponderType.AMBULANCE, "South"),
                new Responder("Ambulance Charlie", ResponderType.AMBULANCE, "East"),
                new Responder("Fire Truck One", ResponderType.FIRE_TRUCK, "North"),
                new Responder("Fire Truck Two", ResponderType.FIRE_TRUCK, "South"),
                new Responder("Fire Truck Three", ResponderType.FIRE_TRUCK, "East"),
                new Responder("Police Unit 1", ResponderType.POLICE, "North"),
                new Responder("Police Unit 2", ResponderType.POLICE, "South"),
                new Responder("Police Unit 3", ResponderType.POLICE, "East")));
        log.info("Seeded 9 demo responders");
    }
}
