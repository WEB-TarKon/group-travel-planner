import { IsArray, IsOptional, IsString, MaxLength } from "class-validator";

export class SendMessageDto {
    @IsOptional()
    @IsString()
    @MaxLength(4000)
    text?: string;

    @IsOptional()
    @IsString()
    fileUrl?: string;

    @IsOptional()
    @IsString()
    fileName?: string;

    @IsOptional()
    @IsString()
    fileMime?: string;

    @IsOptional()
    @IsString()
    replyToId?: string;

    @IsOptional()
    @IsArray()
    mentions?: string[]; // userId[]
}
