package controlador;

import java.sql.*;
import javax.swing.JButton;
import javax.swing.JOptionPane;
import javax.swing.JTextField;

public class conexion {

    public Connection conexion = null;
    public String bde = "atrepresentaciones";
    public int pregunta = 0;
    public String login = "postgres";
    public String password = "123456";
    //FINAL NO PERMITE A SE LE ASIGNE NINGUN OTRO VALOR SIEMPRE CONTENTRA EL MISMO
    public final String CONTROLADOR_JDBC = "org.postgresql.Driver";
    public final String URL_BASEDEDATOS = "jdbc:postgresql://localhost:5432/" + bde;
    public Statement statement;
    public ResultSet resultado;

    /*-------------------------------------------------------------------------------*/

    public Connection conecta() {
        try {
            //Aqui se carga el driver..
            Class.forName(CONTROLADOR_JDBC);
            //Efectua la conexion con la direccion de bd el login y el password..
            conexion = DriverManager.getConnection(URL_BASEDEDATOS, login, password);
//         JOptionPane.showMessageDialog(null, "Conexion Exitosa");
        } catch (ClassNotFoundException driver) {
            JOptionPane.showMessageDialog(null, "Driver no lacalizado" + driver);
        } catch (SQLException fuente) {
            JOptionPane.showMessageDialog(null, "No localizo la base de datos" + fuente);
        }
        return conexion;
    }

    //Genera autonumerico
    public void autonumerico(String tabla, String condicion, JTextField texto) {
        try {
            //enviamos la sentencia a la bd
            statement = conexion.createStatement();
            resultado = statement.executeQuery("select coalesce(max(" + condicion + "),0)+1 as cod from " + tabla + "");
            resultado.next();
            texto.setText(resultado.getString("cod"));
        } catch (Exception e) {
            JOptionPane.showMessageDialog(null, "Error" + e);

        }

    }

    public void retornar_ultimo(String tabla, String condicion, JTextField texto) {
        try {
            //enviamos la sentencia a la bd
            statement = conexion.createStatement();
            resultado = statement.executeQuery("select coalesce(max(" + condicion + "),0) as cod from " + tabla + "");
            resultado.next();
            texto.setText(resultado.getString("cod"));
        } catch (Exception e) {
            JOptionPane.showMessageDialog(null, "Error" + e);

        }

    }

    public void listar_datos(String sql) {
        try {
            statement = conexion.createStatement();
            resultado = statement.executeQuery(sql);
        } catch (Exception e) {
            JOptionPane.showMessageDialog(null, "Error al listar datos" + e);
        }
    }

   
}
