INSERT INTO roadmaps (slug, title, description, target_role, estimated_weeks) VALUES
    ('aws-solutions-architect-associate', 'AWS Solutions Architect - Associate', 'Build practical AWS architecture skills and prepare for the associate certification.', 'Cloud Engineer', 12),
    ('comptia-security-plus', 'CompTIA Security+', 'Develop security fundamentals through domain study and hands-on analysis.', 'Cybersecurity Analyst', 10),
    ('java-spring-backend', 'Java and Spring Backend', 'Progress from Java language fundamentals to a tested Spring Boot REST API.', 'Backend Java Developer', 14);

INSERT INTO roadmap_stages (roadmap_id, stage_order, title)
SELECT id, 1, 'Cloud foundations' FROM roadmaps WHERE slug = 'aws-solutions-architect-associate'
UNION ALL
SELECT id, 2, 'Architecture labs' FROM roadmaps WHERE slug = 'aws-solutions-architect-associate'
UNION ALL
SELECT id, 3, 'Exam readiness' FROM roadmaps WHERE slug = 'aws-solutions-architect-associate'
UNION ALL
SELECT id, 1, 'Security concepts' FROM roadmaps WHERE slug = 'comptia-security-plus'
UNION ALL
SELECT id, 2, 'Operations labs' FROM roadmaps WHERE slug = 'comptia-security-plus'
UNION ALL
SELECT id, 3, 'Exam readiness' FROM roadmaps WHERE slug = 'comptia-security-plus'
UNION ALL
SELECT id, 1, 'Modern Java' FROM roadmaps WHERE slug = 'java-spring-backend'
UNION ALL
SELECT id, 2, 'Spring Boot' FROM roadmaps WHERE slug = 'java-spring-backend'
UNION ALL
SELECT id, 3, 'API quality' FROM roadmaps WHERE slug = 'java-spring-backend';

INSERT INTO stage_outcomes (stage_id, outcome_order, outcome_text)
SELECT s.id, v.outcome_order, v.outcome_text
FROM roadmap_stages s
JOIN roadmaps r ON r.id = s.roadmap_id
JOIN (VALUES
    ('aws-solutions-architect-associate', 1, 1, 'Explain IAM and shared responsibility'),
    ('aws-solutions-architect-associate', 1, 2, 'Use core AWS terminology'),
    ('aws-solutions-architect-associate', 2, 1, 'Build a VPC and EC2 workload'),
    ('aws-solutions-architect-associate', 2, 2, 'Host a static site in S3'),
    ('aws-solutions-architect-associate', 3, 1, 'Review architecture tradeoffs'),
    ('aws-solutions-architect-associate', 3, 2, 'Complete timed practice exams'),
    ('comptia-security-plus', 1, 1, 'Identify common threats'),
    ('comptia-security-plus', 1, 2, 'Explain security controls'),
    ('comptia-security-plus', 2, 1, 'Inspect network traffic with Wireshark'),
    ('comptia-security-plus', 2, 2, 'Practice introductory SIEM searches'),
    ('comptia-security-plus', 3, 1, 'Map gaps to exam objectives'),
    ('comptia-security-plus', 3, 2, 'Complete performance-based practice'),
    ('java-spring-backend', 1, 1, 'Model data with classes and records'),
    ('java-spring-backend', 1, 2, 'Use collections and exceptions'),
    ('java-spring-backend', 2, 1, 'Build controller and service layers'),
    ('java-spring-backend', 2, 2, 'Use dependency injection'),
    ('java-spring-backend', 3, 1, 'Test business and HTTP behavior'),
    ('java-spring-backend', 3, 2, 'Document API contracts')
) AS v(roadmap_slug, stage_order, outcome_order, outcome_text)
    ON v.roadmap_slug = r.slug AND v.stage_order = s.stage_order;
