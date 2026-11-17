using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Configurator.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RoomLayout : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GroupName",
                table: "Rooms",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsHidden",
                table: "Rooms",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<double>(
                name: "PositionX",
                table: "Rooms",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "PositionZ",
                table: "Rooms",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GroupName",
                table: "Rooms");

            migrationBuilder.DropColumn(
                name: "IsHidden",
                table: "Rooms");

            migrationBuilder.DropColumn(
                name: "PositionX",
                table: "Rooms");

            migrationBuilder.DropColumn(
                name: "PositionZ",
                table: "Rooms");
        }
    }
}
