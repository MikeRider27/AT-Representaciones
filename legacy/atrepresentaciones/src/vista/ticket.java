/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package vista;

/**
 *
 * @author javier
 */
public class ticket {
    void imprimirFactura(){

//        PrinterMatrix printer = new PrinterMatrix();
//
//        Extenso e = new Extenso();
//
//        e.setNumber(101.85);
//
//
//        //Definir el tamanho del papel para la impresion  aca 25 lineas y 80 columnas
//        printer.setOutSize(60, 80);
//        //Imprimir * de la 2da linea a 25 en la columna 1;
//       // printer.printCharAtLin(2, 25, 1, "*");
//        //Imprimir * 1ra linea de la columa de 1 a 80
//       printer.printCharAtCol(1, 1, 80, "=");
//        //Imprimir Encabezado nombre del La EMpresa
//       printer.printTextWrap(1, 2, 30, 80, "FACTURA DE VENTA");
//       //printer.printTextWrap(linI, linE, colI, colE, null);
//       printer.printTextWrap(2, 3, 1, 22, "Num. Boleta : " + txtVentaNumeroFactura.getText());
//       printer.printTextWrap(2, 3, 25, 55, "Fecha de Emision: " + dateFechaVenta.getDate());
//       printer.printTextWrap(2, 3, 60, 80, "Hora: 12:22:51");
//       printer.printTextWrap(3, 3, 1, 80, "Vendedor.  : "+ txtVentaIdVendedor.getText() +" - " + txtVentaNombreVendedor.getText());
//       printer.printTextWrap(4, 4, 1, 80, "CLIENTE: " + txtVentaNombreCliente.getText());
//       printer.printTextWrap(5, 5, 1, 80, "RUC/CI.: " + txtVentaRucCliente.getText());
//       printer.printTextWrap(6, 6, 1, 80, "DIRECCION: " + "");
//       printer.printCharAtCol(7, 1, 80, "=");
//       printer.printTextWrap(7, 8, 1, 80, "Codigo          Descripcion                Cant.      P  P.Unit.      P.Total");
//       printer.printCharAtCol(9, 1, 80, "-");
//       int filas = tblVentas.getRowCount();
//
//        for (int i = 0; i < filas; i++) { printer.printTextWrap(9 + i, 10, 1, 80, tblVentas.getValueAt(i,0).toString()+"|"+tblVentas.getValueAt(i,1).toString()+"| "+tblVentas.getValueAt(i,2).toString()+"| "+tblVentas.getValueAt(i,3).toString()+"|"+ tblVentas.getValueAt(i,4).toString()); } if(filas > 15){
//        printer.printCharAtCol(filas + 1, 1, 80, "=");
//        printer.printTextWrap(filas + 1, filas + 2, 1, 80, "TOTAL A PAGAR " + txtVentaTotal.getText());
//        printer.printCharAtCol(filas + 2, 1, 80, "=");
//        printer.printTextWrap(filas + 2, filas + 3, 1, 80, "Esta boleta no tiene valor fiscal, solo para uso interno.: + Descripciones........");
//        }else{
//        printer.printCharAtCol(25, 1, 80, "=");
//        printer.printTextWrap(26, 26, 1, 80, "TOTAL A PAGAR " + txtVentaTotal.getText());
//        printer.printCharAtCol(27, 1, 80, "=");
//        printer.printTextWrap(27, 28, 1, 80, "Esta boleta no tiene valor fiscal, solo para uso interno.: + Descripciones........");
//
//        }
//        printer.toFile("impresion.txt");
//
//      FileInputStream inputStream = null;
//        try {
//            inputStream = new FileInputStream("impresion.txt");
//        } catch (FileNotFoundException ex) {
//            ex.printStackTrace();
//        }
//        if (inputStream == null) {
//            return;
//        }
//
//        DocFlavor docFormat = DocFlavor.INPUT_STREAM.AUTOSENSE;
//        Doc document = new SimpleDoc(inputStream, docFormat, null);
//
//        PrintRequestAttributeSet attributeSet = new HashPrintRequestAttributeSet();
//
//        PrintService defaultPrintService = PrintServiceLookup.lookupDefaultPrintService();
//
//
//        if (defaultPrintService != null) {
//            DocPrintJob printJob = defaultPrintService.createPrintJob();
//            try {
//                printJob.print(document, attributeSet);
//
//            } catch (Exception ex) {
//                ex.printStackTrace();
//            }
//        } else {
//            System.err.println("No existen impresoras instaladas");
//        }
//
//        //inputStream.close();
//     
    }
}
