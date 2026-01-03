import {
    IsEmail,
    IsOptional,
    IsString,
    Matches,
    MinLength,
    MaxLength,
} from "class-validator";

export class RegisterDto {
    @IsString()
    @MinLength(2)
    @MaxLength(50)
    @Matches(/^[A-Za-zА-Яа-яІіЇїЄє'’\- ]+$/, { message: "Ім’я має містити лише літери" })
    firstName!: string;

    @IsString()
    @MinLength(2)
    @MaxLength(50)
    @Matches(/^[A-Za-zА-Яа-яІіЇїЄє'’\- ]+$/, { message: "Прізвище має містити лише літери" })
    lastName!: string;

    @IsEmail()
    email!: string;

    @IsString()
    @MinLength(3)
    @MaxLength(24)
    @Matches(/^[a-zA-Z0-9_]+$/, { message: "Логін: лише латиниця/цифри/_" })
    login!: string;

    @IsOptional()
    @IsString()
    @Matches(/^\+?[0-9]{8,16}$/, { message: "Телефон має бути у міжнародному форматі" })
    phone?: string;

    @IsOptional()
    @IsString()
    @Matches(/^@?[a-zA-Z0-9_]{5,32}$/, { message: "Некоректний Telegram username" })
    telegramUsername?: string;

    @IsString()
    @MinLength(8)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
        message: "Пароль: великі+малі літери, цифра і спецсимвол",
    })
    password!: string;

    @IsString()
    confirmPassword!: string;
}

export class LoginDto {
    @IsString()
    identifier!: string; // login або email

    @IsString()
    password!: string;
}

export class GoogleAuthDto {
    @IsString()
    credential!: string; // Google ID token (JWT) з фронта
}

export class PasswordResetRequestDto {
    @IsEmail()
    email!: string;
}

export class PasswordResetConfirmDto {
    @IsString()
    token!: string;

    @IsString()
    @MinLength(8)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
        message: "Пароль: великі+малі літери, цифра і спецсимвол",
    })
    newPassword!: string;

    @IsString()
    confirmPassword!: string;
}
