package com.resqnet.responder.repository;

import com.resqnet.responder.model.Responder;
import com.resqnet.responder.model.ResponderStatus;
import com.resqnet.responder.model.ResponderType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ResponderRepository extends JpaRepository<Responder, Long> {

    /** Used for idempotency: does this incident already hold a responder? */
    Optional<Responder> findByCurrentIncidentId(Long incidentId);

    List<Responder> findAllByOrderByIdAsc();

    List<Responder> findByStatusOrderByIdAsc(ResponderStatus status);

    List<Responder> findByTypeOrderByIdAsc(ResponderType type);

    List<Responder> findByStatusAndTypeOrderByIdAsc(ResponderStatus status, ResponderType type);

    /**
     * THE ATOMIC ASSIGNMENT QUERY (hard idea #1).
     * "FOR UPDATE" locks the chosen row until the surrounding transaction ends, so no one else can take it.
     * "SKIP LOCKED" means: if another transaction already locked a row, do not wait, silently move
     * on to the next available row. Two simultaneous requests therefore always get two DIFFERENT
     * responders (or "none left"), and nobody blocks.
     * It must be called inside a transaction; the lock is released at commit.
     */
    @Query(value = """
            SELECT * FROM responders
            WHERE responder_type = :type AND status = 'AVAILABLE'
            ORDER BY id
            LIMIT 1
            FOR UPDATE SKIP LOCKED
            """, nativeQuery = true)
    Optional<Responder> lockFirstAvailable(@Param("type") String type);
}
