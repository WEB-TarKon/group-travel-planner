import {Type} from "class-transformer";
import {ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, ValidateNested} from "class-validator";

class WaypointDto {
    @IsNumber() order!: number;
    @IsNumber() lat!: number;
    @IsNumber() lng!: number;
    @IsOptional()
    @IsString()
    title?: string;
}

export class SaveWaypointsDto {
    @IsArray()
    @ValidateNested({each: true})
    @Type(() => WaypointDto)
    waypoints!: WaypointDto[];
}
