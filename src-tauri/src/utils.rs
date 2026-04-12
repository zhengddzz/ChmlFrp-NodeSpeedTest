pub fn sanitize_log(message: &str, secrets: &[&str]) -> String {
    let mut result = message.to_string();
    for secret in secrets {
        if secret.is_empty() {
            continue;
        }
        result = sanitize_token(&result, secret);
    }
    result
}

fn sanitize_token(message: &str, token: &str) -> String {
    let mut result = message.to_string();

    result = result.replace(&format!("{}.", token), "");
    result = result.replace(&format!("{}-", token), "");
    result = result.replace(token, "");

    if let Some(dot_pos) = token.find('.') {
        let first_part = &token[..dot_pos];
        let second_part = &token[dot_pos + 1..];

        if first_part.len() >= 6 {
            result = result.replace(first_part, "***");
        }
        if second_part.len() >= 6 {
            result = result.replace(second_part, "***");
        }
    }

    if token.len() >= 10 {
        for window_size in (8..=token.len()).rev() {
            if window_size <= token.len() {
                let substr = &token[..window_size];
                if result.contains(substr) && substr.len() >= 8 {
                    result = result.replace(substr, "***");
                }
            }
        }
    }

    result
}
