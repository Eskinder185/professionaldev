package dev.eskinder.roadmap.progress;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ProgressConfiguration {

	@Bean
	Clock clock() {
		return Clock.systemUTC();
	}
}
