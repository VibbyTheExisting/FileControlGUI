namespace TestProject {
    public class Program {
        public static void Main(string[] args) {
            var builder = WebApplication.CreateBuilder(args);

            builder.Services.AddControllers();

            var app = builder.Build();

            // make sure / is index.html
            app.UseDefaultFiles();
            app.UseStaticFiles();
            app.MapControllers();

            app.Run();
        }
    }
}
