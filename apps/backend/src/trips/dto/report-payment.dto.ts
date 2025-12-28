import { IsOptional, IsString, MaxLength } from "class-validator";

export class ReportPaymentDto {
    @IsOptional()
    @IsString()
    @MaxLength(500)
    note?: string;
}
