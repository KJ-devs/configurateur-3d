using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Configurator.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Materials",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    ColorHex = table.Column<string>(type: "character varying(9)", maxLength: 9, nullable: false),
                    TextureUrl = table.Column<string>(type: "text", nullable: true),
                    Thicknesses = table.Column<int[]>(type: "integer[]", nullable: false),
                    Depths = table.Column<int[]>(type: "integer[]", nullable: false),
                    PricePerM2 = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Materials", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Projects",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ShareCode = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Projects", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FurnitureModels",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Category = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Type = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Width = table.Column<int>(type: "integer", nullable: false),
                    Height = table.Column<int>(type: "integer", nullable: false),
                    Depth = table.Column<int>(type: "integer", nullable: false),
                    AssetUrl = table.Column<string>(type: "text", nullable: true),
                    ParametricDefinition = table.Column<string>(type: "jsonb", nullable: true),
                    ThumbnailUrl = table.Column<string>(type: "text", nullable: true),
                    BasePrice = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    MaterialId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FurnitureModels", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FurnitureModels_Materials_MaterialId",
                        column: x => x.MaterialId,
                        principalTable: "Materials",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Rooms",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    FloorPolygon = table.Column<string>(type: "jsonb", nullable: false),
                    CeilingHeight = table.Column<int>(type: "integer", nullable: false),
                    WallThickness = table.Column<int>(type: "integer", nullable: false),
                    FloorMaterialId = table.Column<Guid>(type: "uuid", nullable: true),
                    WallMaterialId = table.Column<Guid>(type: "uuid", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Rooms", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Rooms_Materials_FloorMaterialId",
                        column: x => x.FloorMaterialId,
                        principalTable: "Materials",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Rooms_Materials_WallMaterialId",
                        column: x => x.WallMaterialId,
                        principalTable: "Materials",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Rooms_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FurnitureInstances",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RoomId = table.Column<Guid>(type: "uuid", nullable: false),
                    FurnitureModelId = table.Column<Guid>(type: "uuid", nullable: false),
                    X = table.Column<double>(type: "double precision", nullable: false),
                    Z = table.Column<double>(type: "double precision", nullable: false),
                    RotationY = table.Column<double>(type: "double precision", nullable: false),
                    ColorOverride = table.Column<string>(type: "character varying(9)", maxLength: 9, nullable: true),
                    ParametricOverride = table.Column<string>(type: "jsonb", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FurnitureInstances", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FurnitureInstances_FurnitureModels_FurnitureModelId",
                        column: x => x.FurnitureModelId,
                        principalTable: "FurnitureModels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FurnitureInstances_Rooms_RoomId",
                        column: x => x.RoomId,
                        principalTable: "Rooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Openings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RoomId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    WallIndex = table.Column<int>(type: "integer", nullable: false),
                    Offset = table.Column<double>(type: "double precision", nullable: false),
                    Width = table.Column<int>(type: "integer", nullable: false),
                    Height = table.Column<int>(type: "integer", nullable: false),
                    SillHeight = table.Column<int>(type: "integer", nullable: false),
                    HingeSide = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Openings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Openings_Rooms_RoomId",
                        column: x => x.RoomId,
                        principalTable: "Rooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FurnitureInstances_FurnitureModelId",
                table: "FurnitureInstances",
                column: "FurnitureModelId");

            migrationBuilder.CreateIndex(
                name: "IX_FurnitureInstances_RoomId",
                table: "FurnitureInstances",
                column: "RoomId");

            migrationBuilder.CreateIndex(
                name: "IX_FurnitureModels_Category",
                table: "FurnitureModels",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_FurnitureModels_MaterialId",
                table: "FurnitureModels",
                column: "MaterialId");

            migrationBuilder.CreateIndex(
                name: "IX_Openings_RoomId",
                table: "Openings",
                column: "RoomId");

            migrationBuilder.CreateIndex(
                name: "IX_Projects_ShareCode",
                table: "Projects",
                column: "ShareCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Rooms_FloorMaterialId",
                table: "Rooms",
                column: "FloorMaterialId");

            migrationBuilder.CreateIndex(
                name: "IX_Rooms_ProjectId",
                table: "Rooms",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_Rooms_WallMaterialId",
                table: "Rooms",
                column: "WallMaterialId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FurnitureInstances");

            migrationBuilder.DropTable(
                name: "Openings");

            migrationBuilder.DropTable(
                name: "FurnitureModels");

            migrationBuilder.DropTable(
                name: "Rooms");

            migrationBuilder.DropTable(
                name: "Materials");

            migrationBuilder.DropTable(
                name: "Projects");
        }
    }
}
