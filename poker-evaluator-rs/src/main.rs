use poker_evaluator::*;
use std::env;

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() < 2 {
        println!("========================================================");
        println!(" Texas Hold'em Poker Hand Evaluator (Rust Module)");
        println!("========================================================");
        println!("Uso 1 (Evaluar mano):");
        println!("  cargo run -- \"As Kh Qd Jc Ts\"");
        println!("  cargo run -- \"As Kh 8d 4c 2s 7d 3h\"");
        println!("\nUso 2 (Showdown entre dos jugadores):");
        println!("  cargo run --showdown \"As Kh\" \"Qh Qd\" \"Ac 7d 2s 4h 9c\"");
        println!("========================================================");

        // Run quick sample demonstration
        println!("\nDemostración automática:");
        demo_eval("As Ks Qs Js Ts", "Escalera Real (Royal Flush)");
        demo_eval("As 5s 4s 3s 2s", "Escalera de Color a la Rueda (Steel Wheel)");
        demo_eval("8s 8h 8d 8c Ks", "Póker de Ochos con Kicker Rey");
        demo_eval("Ks Kh Kd Qs Qh", "Full de Reyes y Damas");
        demo_eval("As Js 9s 6s 2s", "Color al As");
        demo_eval("9s 8h 7d 6c 5s", "Escalera al Nueve");
        demo_eval("Ts Th Td As Kc", "Trío de Dieces con Kicker As y Rey");
        demo_eval("As Ah Ks Kh Qd", "Doble Pareja de Ases y Reyes con Dama");
        demo_eval("As Ah Kd Qd Jc", "Pareja de Ases");
        demo_eval("As Kd Qd Jc 9s", "Carta Alta al As");

        println!("\nShowdown de muestra (Kicker Battle):");
        let s_res = showdown_str("As Kh", "Ad Qc", "Ac 8d 6s 4h 2c").unwrap();
        println!("  Hero [A♠ K♥] vs Villano [A♦ Q♣] en mesa [A♣ 8♦ 6♠ 4♥ 2♣]:");
        println!("  -> {}", s_res);
        return;
    }

    if args[1] == "--showdown" && args.len() >= 5 {
        let hero = &args[2];
        let villain = &args[3];
        let board = &args[4];
        match showdown_str(hero, villain, board) {
            Ok(res) => println!("{}", res),
            Err(e) => eprintln!("Error en showdown: {}", e),
        }
        return;
    }

    let cards_str = &args[1];
    match eval_str(cards_str) {
        Ok(rank) => {
            println!("Cartas evaluadas: {}", cards_str);
            println!("Clasificación: {} ({})", rank.description_es, rank.category.name_es());
            println!("Mejores 5 cartas: {}{}{}{}{}",
                rank.best_five[0],
                rank.best_five[1],
                rank.best_five[2],
                rank.best_five[3],
                rank.best_five[4]
            );
            println!("Desempates (Tiebreakers): {:?}", rank.tiebreakers);
            println!("Puntaje Primario Monotónico: {}", rank.primary_score());
        }
        Err(e) => eprintln!("Error al evaluar cartas: {}", e),
    }
}

fn demo_eval(cards: &str, expected: &str) {
    match eval_str(cards) {
        Ok(rank) => {
            println!("  [{}] -> {} ({})", cards, rank.description_es, expected);
        }
        Err(e) => eprintln!("  [{}] -> Error: {}", cards, e),
    }
}
