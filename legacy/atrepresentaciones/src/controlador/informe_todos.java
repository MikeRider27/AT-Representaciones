/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package controlador;

import java.awt.Image;
import java.net.URL;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;
import javax.swing.Icon;
import javax.swing.JOptionPane;
import net.sf.jasperreports.compilers.JRGroovyCompiler;
import net.sf.jasperreports.engine.JRException;
import net.sf.jasperreports.engine.JRExporter;
import net.sf.jasperreports.engine.JRExporterParameter;
import net.sf.jasperreports.engine.JRResultSetDataSource;
import net.sf.jasperreports.engine.JasperFillManager;
import net.sf.jasperreports.engine.JasperPrint;
import net.sf.jasperreports.engine.JasperReport;
import net.sf.jasperreports.engine.export.JRPdfExporter;
import net.sf.jasperreports.engine.util.JRLoader;
import net.sf.jasperreports.view.JasperViewer;

/**
 *
 * @author User
 */
public class informe_todos {
    conexion bd = new conexion();
//    conexion bd = new conexion();
//    Image v;

    public void car(String consulta, String nombrerporte, String fec1, String fec2) {

        bd.conecta();
        bd.listar_datos(consulta);
        try {

            JRResultSetDataSource si = new JRResultSetDataSource(bd.resultado);

            Map parameters = new HashMap();
            parameters.put("fecha1", fec1);
            parameters.put("fecha2", fec2);
            URL urlMaestro = getClass().getClassLoader().getResource("informes/" + nombrerporte + ".jasper");
            // Cargamos el reporte
            JasperReport masterReport = null;
            masterReport = (JasperReport) JRLoader.loadObject(urlMaestro);
            JasperPrint masterPrint = null;
            masterPrint = JasperFillManager.fillReport(masterReport, parameters,si);
           

            JasperViewer ventana = new JasperViewer(masterPrint, false);
            ventana.setTitle("REPORTE " + nombrerporte + "".toUpperCase());
            ventana.setExtendedState(ventana.MAXIMIZED_BOTH);
            ventana.setVisible(true);
            try {
                bd.resultado.close();

            } catch (SQLException ex) {
                Logger.getLogger(informe_todos.class.getName()).log(Level.SEVERE, null, ex);
            }
        } catch (JRException e) {
            //e.printStackTrace();
            System.out.println("Error:" + e.getMessage());
        }

    }
     
}
